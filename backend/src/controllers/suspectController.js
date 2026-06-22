// src/controllers/suspectController.js
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { parseFaceImage } = require('../utils/faceBiometric');

const VALID_GENDERS = new Set(['male', 'female']);

const normalizeOptional = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const validateSuspectPayload = (body, { partial = false } = {}) => {
  const errors = [];
  const fullName = normalizeOptional(body.full_name);
  const age = normalizeOptional(body.age);
  const phone = normalizeOptional(body.phone);
  const gender = normalizeOptional(body.gender);

  if (!partial && !fullName) errors.push('Full name is required.');
  if (fullName && fullName.length < 3) errors.push('Full name must be at least 3 characters.');
  if (gender && !VALID_GENDERS.has(gender)) errors.push('Gender must be male or female.');
  if (age !== null) {
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      errors.push('Age must be a whole number between 1 and 120.');
    }
  }
  if (phone && !/^[+\d][\d\s-]{6,24}$/.test(phone)) {
    errors.push('Phone number format is invalid.');
  }

  return errors;
};

const buildScopedCaseJoinWhere = (user, params, alias = 'c') => {
  let where = '1=1';
  if (user.scopeType === 'state_administration') { where += ` AND ${alias}.state_administration_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'region') { where += ` AND ${alias}.region_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'city') { where += ` AND ${alias}.city_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'district') { where += ` AND ${alias}.district_id = ?`; params.push(user.scopeId); }
  return where;
};

const buildPhotoUrl = (file) => {
  if (!file) return null;
  return `/uploads/offenders/${file.filename}`;
};

const getFaceKeyFromDataImage = (faceImage) => parseFaceImage(faceImage).biometricKey;

const saveFaceCaptureImage = (faceImage) => {
  if (!faceImage) return null;
  const { buffer, extension, biometricKey } = parseFaceImage(faceImage);
  const uploadDir = path.join(__dirname, '../../uploads/offenders');
  fs.mkdirSync(uploadDir, { recursive: true });
  const filename = `face-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`;
  fs.writeFileSync(path.join(uploadDir, filename), buffer, { mode: 0o600 });
  return {
    url: `/uploads/offenders/${filename}`,
    biometricKey,
  };
};

const sentenceMetrics = (row) => {
  if (!row.sentence_start_date || !row.expected_release_date) {
    return { served_days: 0, remaining_days: null, sentence_progress_percent: 0, release_due: false };
  }

  const start = new Date(`${row.sentence_start_date}T00:00:00Z`);
  const release = new Date(`${row.expected_release_date}T00:00:00Z`);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const totalDays = Math.max(1, Math.ceil((release - start) / 86400000));
  const servedDays = Math.max(0, Math.min(totalDays, Math.floor((today - start) / 86400000)));
  const remainingDays = Math.max(0, Math.ceil((release - today) / 86400000));
  const releaseDue = today >= release && ['sentenced', 'serving', 'release_review'].includes(row.sentence_status);

  return {
    served_days: servedDays,
    remaining_days: remainingDays,
    sentence_progress_percent: Math.min(100, Math.round((servedDays / totalDays) * 100)),
    release_due: releaseDue,
  };
};

const hydrateArrests = (rows) => rows.map((row) => ({ ...row, ...sentenceMetrics(row) }));

const applyCaseScope = (user, sql, params, alias = 'c_scope') => {
  if (user.scopeType === 'state_administration') { sql += ` AND ${alias}.state_administration_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'region') { sql += ` AND ${alias}.region_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'city') { sql += ` AND ${alias}.city_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'district') { sql += ` AND ${alias}.district_id = ?`; params.push(user.scopeId); }
  return sql;
};

const canAccessCase = async (user, caseId) => {
  const [[row]] = await db.query(
    'SELECT state_administration_id, region_id, city_id, district_id FROM cases WHERE id = ?',
    [caseId]
  );
  if (!row) return false;
  if (!user.scopeType) return true;
  const columnMap = {
    state_administration: 'state_administration_id',
    region: 'region_id',
    city: 'city_id',
    district: 'district_id',
  };
  return Number(row[columnMap[user.scopeType]]) === Number(user.scopeId);
};

const findMatchingSuspect = async ({ id_number, phone, full_name }) => {
  if (id_number) {
    const [[row]] = await db.query('SELECT * FROM criminals WHERE id_number = ? LIMIT 1', [id_number]);
    if (row) return { row, matchReason: 'id_number' };
  }
  if (phone && full_name) {
    const [[row]] = await db.query(
      'SELECT * FROM criminals WHERE phone = ? AND LOWER(full_name) = LOWER(?) LIMIT 1',
      [phone, full_name]
    );
    if (row) return { row, matchReason: 'phone_and_name' };
  }
  return null;
};

const checkDuplicate = async (req, res, next) => {
  try {
    const { id_type, id_number } = req.query;
    if (!id_number) {
      return res.status(400).json({ success: false, message: 'ID number is required.' });
    }
    const [[row]] = await db.query(
      'SELECT * FROM criminals WHERE LOWER(id_type) = LOWER(?) AND id_number = ? LIMIT 1',
      [id_type || '', id_number]
    );
    if (row) {
      return res.json({ success: true, exists: true, data: row });
    }
    res.json({ success: true, exists: false });
  } catch (err) { next(err); }
};

const getcriminals = async (req, res, next) => {
  try {
    const { case_id, search, gender, nationality, arrested, repeat } = req.query;
    if (case_id) {
      const scopeParams = [case_id];
      let scopeWhere = 'cs.case_id = ?';
      if (req.user.scopeType) {
        scopeWhere = applyCaseScope(req.user, scopeWhere, scopeParams, 'c_scope');
      }
      const [rows] = await db.query(
        `SELECT s.*, cs.role_in_case, cs.notes AS case_notes,
                (SELECT COUNT(*) FROM case_criminals csh WHERE csh.criminal_id = s.id) AS case_count
         FROM criminals s
         JOIN case_criminals cs ON s.id = cs.criminal_id
         JOIN cases c_scope ON c_scope.id = cs.case_id
         WHERE ${scopeWhere}
         GROUP BY s.id, cs.role_in_case, cs.notes`, scopeParams);
      return res.json({ success: true, data: rows });
    }
    let sql = `
      SELECT s.*, (SELECT COUNT(*) FROM case_criminals cs WHERE cs.criminal_id = s.id) AS case_count
      FROM criminals s
      ${req.user.scopeType ? 'JOIN case_criminals cs_scope ON s.id = cs_scope.criminal_id JOIN cases c_scope ON c_scope.id = cs_scope.case_id' : ''}
      WHERE 1=1
    `;
    const params = [];
    if (req.user.scopeType) {
      sql = applyCaseScope(req.user, sql, params);
    }
    if (search) {
      sql += ' AND (s.full_name LIKE ? OR s.alias LIKE ? OR s.id_number LIKE ? OR s.phone LIKE ? OR s.address LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (gender) { sql += ' AND s.gender = ?'; params.push(gender); }
    if (nationality) { sql += ' AND s.nationality LIKE ?'; params.push(`%${nationality}%`); }
    if (arrested !== undefined) { sql += ' AND s.is_arrested = ?'; params.push(arrested === 'true' || arrested === '1' ? 1 : 0); }
    sql += ' GROUP BY s.id';
    if (repeat === 'true' || repeat === '1') sql += ' HAVING case_count > 1';
    const [rows] = await db.query(sql + ' ORDER BY case_count DESC, s.full_name ASC', params);
    const ids = rows.map((row) => row.id);
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const [sentenceRows] = await db.query(
        `SELECT suspect_id,
                COUNT(*) AS arrest_count,
                SUM(CASE WHEN sentence_status IN ('wanted','escaped') THEN 1 ELSE 0 END) AS wanted_or_escaped_count,
                SUM(CASE WHEN expected_release_date <= CURDATE() AND sentence_status IN ('sentenced','serving','release_review') THEN 1 ELSE 0 END) AS due_release_count,
                MAX(expected_release_date) AS next_release_date
         FROM arrests
         WHERE suspect_id IN (${placeholders})
         GROUP BY suspect_id`,
        ids
      );
      const sentenceMap = new Map(sentenceRows.map((row) => [Number(row.suspect_id), row]));
      rows.forEach((row) => Object.assign(row, sentenceMap.get(Number(row.id)) || {
        arrest_count: 0,
        wanted_or_escaped_count: 0,
        due_release_count: 0,
        next_release_date: null,
      }));
    }
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getSuspectById = async (req, res, next) => {
  try {
    const [[row]] = await db.query(`
      SELECT s.*, (SELECT COUNT(*) FROM case_criminals cs WHERE cs.criminal_id = s.id) AS case_count
      FROM criminals s
      WHERE s.id = ?
      GROUP BY s.id
    `, [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Criminal not found.' });
    const [cases] = await db.query(
      `SELECT c.id, c.ob_number, COALESCE(c.title, c.case_title) AS title, cs.role_in_case
       FROM cases c
       JOIN case_criminals cs ON c.id = cs.case_id
       WHERE cs.criminal_id = ?`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...row, cases } });
  } catch (err) { next(err); }
};

const createSuspect = async (req, res, next) => {
  try {
    const errors = validateSuspectPayload(req.body);
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(' ') });

    const {
      case_id, full_name, mother_name, alias, gender, date_of_birth, age, nationality, id_type, id_number,
      phone, address, description, role_in_case, face_capture_image, face_capture_notes,
      profile_notes, arrest_status
    } = req.body;
    if (case_id && !(await canAccessCase(req.user, case_id))) {
      return res.status(403).json({ success: false, message: 'You cannot add a suspect to a case outside your station scope.' });
    }
    const existingMatch = await findMatchingSuspect({
      id_number: normalizeOptional(id_number),
      phone: normalizeOptional(phone),
      full_name: full_name.trim(),
    });

    if (existingMatch) {
      // Profile already exists — do NOT link or create anything. Just notify the caller.
      return res.status(409).json({
        success: false,
        matchedExisting: true,
        matchReason: existingMatch.matchReason,
        data: existingMatch.row,
        message: `Qofkan horey ayaa loo diiwaan-geliyey (${existingMatch.row.full_name}). Ma jiro wax ficil ah oo la qaadayo.`,
      });
    }

    const photoUrl = buildPhotoUrl(req.file);
    const faceCapture = saveFaceCaptureImage(face_capture_image);
    const faceCaptureUrl = faceCapture?.url || null;
    const faceKey = faceCapture?.biometricKey || null;
    const isArrested = ['arrested', 'wanted'].includes(arrest_status) ? 1 : 0;
    const [result] = await db.query(
      `INSERT INTO criminals
        (full_name, mother_name, alias, gender, date_of_birth, age, nationality, id_type, id_number,
         phone, address, description, photo_url, offender_photo, face_capture_image, face_capture_notes,
         profile_notes, arrest_status, fingerprint_hash, is_arrested)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name.trim(),
        normalizeOptional(mother_name),
        normalizeOptional(alias),
        gender || 'male',
        normalizeOptional(date_of_birth),
        normalizeOptional(age),
        normalizeOptional(nationality) || 'Somali',
        normalizeOptional(id_type),
        normalizeOptional(id_number),
        normalizeOptional(phone),
        normalizeOptional(address),
        normalizeOptional(description) || normalizeOptional(profile_notes),
        photoUrl,
        photoUrl,
        faceCaptureUrl,
        normalizeOptional(face_capture_notes),
        normalizeOptional(profile_notes),
        normalizeOptional(arrest_status) || 'not_arrested',
        faceKey,
        isArrested,
      ]
    );
    const suspectId = result.insertId;
    if (case_id) {
      await db.query(
        `INSERT INTO case_criminals (case_id, criminal_id, linked_by_user_id, role_in_case, added_by)
         VALUES (?, ?, ?, ?, ?)`,
        [case_id, suspectId, req.user.username || req.user.id, role_in_case || null, req.user.username || req.user.id]
      );
      await db.query(
        `INSERT INTO case_actions (case_id, performed_by, action_type, description)
         VALUES (?, ?, 'SUSPECT_ADDED', ?)`,
        [case_id, req.user.username || req.user.id, `Suspect ${full_name.trim()} added and linked to this case.`]
      );
    }
    await writeAuditLog({ userId: req.user.username || req.user.id, userEmail: req.user.email || req.user.username, action: 'CREATE_SUSPECT', entityType: 'criminals', entityId: suspectId, newData: req.body });
    res.status(201).json({ success: true, message: 'Suspect added.', suspectId });
  } catch (err) { next(err); }
};

const updateSuspect = async (req, res, next) => {
  try {
    const errors = validateSuspectPayload(req.body, { partial: false });
    if (errors.length) return res.status(400).json({ success: false, message: errors.join(' ') });

    const {
      full_name, mother_name, alias, gender, date_of_birth, age, nationality, id_type, id_number,
      phone, address, description, is_arrested, face_capture_image, face_capture_notes, profile_notes, arrest_status
    } = req.body;
    const photoUrl = buildPhotoUrl(req.file);
    const faceCapture = saveFaceCaptureImage(face_capture_image);
    const faceCaptureUrl = faceCapture?.url || null;
    const faceKey = faceCapture?.biometricKey || null;
    const updates = [
      'full_name=?', 'mother_name=?', 'alias=?', 'gender=?', 'date_of_birth=?', 'age=?', 'nationality=?',
      'id_type=?', 'id_number=?', 'phone=?', 'address=?', 'description=?',
      'is_arrested=?', 'face_capture_notes=?', 'profile_notes=?', 'arrest_status=?'
    ];
    const params = [
      full_name.trim(),
      normalizeOptional(mother_name),
      normalizeOptional(alias),
      gender || 'male',
      normalizeOptional(date_of_birth),
      normalizeOptional(age),
      normalizeOptional(nationality) || 'Somali',
      normalizeOptional(id_type),
      normalizeOptional(id_number),
      normalizeOptional(phone),
      normalizeOptional(address),
      normalizeOptional(description) || normalizeOptional(profile_notes),
      is_arrested === true || is_arrested === 'true' || is_arrested === '1' ? 1 : 0,
      normalizeOptional(face_capture_notes),
      normalizeOptional(profile_notes),
      normalizeOptional(arrest_status) || 'not_arrested',
    ];

    if (photoUrl) {
      updates.push('photo_url=?');
      params.push(photoUrl);
      updates.push('offender_photo=?');
      params.push(photoUrl);
    }
    if (faceCaptureUrl) {
      updates.push('face_capture_image=?');
      params.push(faceCaptureUrl);
      updates.push('fingerprint_hash=?');
      params.push(faceKey);
    }

    params.push(req.params.id);
    await db.query(`UPDATE criminals SET ${updates.join(', ')} WHERE id=?`, params);
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE_SUSPECT', entityType: 'criminals', entityId: req.params.id, newData: req.body });
    res.json({ success: true, message: 'Suspect updated.' });
  } catch (err) { next(err); }
};

const releaseSuspect = async (req, res, next) => {
  try {
    const suspectId = req.params.id;
    const { case_id, release_reason, release_notes } = req.body;

    const [[suspect]] = await db.query('SELECT id, full_name, is_arrested FROM criminals WHERE id = ?', [suspectId]);
    if (!suspect) return res.status(404).json({ success: false, message: 'Eedeysanaha lama helin.' });
    if (Number(suspect.is_arrested) !== 1) {
      return res.status(400).json({ success: false, message: 'Eedeysanahaan horey uma xirna.' });
    }

    await db.query("UPDATE criminals SET is_arrested = 0, arrest_status = 'released' WHERE id = ?", [suspectId]);
    await db.query(
      `UPDATE arrests
       SET sentence_status = CASE
             WHEN sentence_status IN ('sentenced','serving','release_review','completed') THEN 'released'
             ELSE sentence_status
           END,
           actual_release_date = COALESCE(actual_release_date, CURDATE()),
           final_status = COALESCE(final_status, ?)
       WHERE suspect_id = ?
         AND sentence_status IN ('awaiting_trial','sentenced','serving','release_review','completed')`,
      [release_reason || 'Released by authorized officer', suspectId]
    );

    const actionDescription = release_reason
      ? `Eedeysane waa la sii daayay. Sabab: ${release_reason}`
      : 'Eedeysane waa la sii daayay.';

    if (case_id) {
      await db.query(
        `INSERT INTO case_actions (case_id, performed_by, action_type, description)
         VALUES (?, ?, ?, ?)`,
        [case_id, req.user.username || req.user.id, 'SUSPECT_RELEASED', actionDescription]
      );
    }

    await writeAuditLog({
      userId: req.user.username || req.user.id,
      userEmail: req.user.email || req.user.username,
      action: 'RELEASE_SUSPECT',
      entityType: 'criminals',
      entityId: parseInt(suspectId, 10),
      newData: {
        suspect_name: suspect.full_name,
        case_id: case_id || null,
        release_reason: release_reason || null,
        release_notes: release_notes || null,
      },
    });

    res.json({ success: true, message: 'Eedeysanaha waa la sii daayay.' });
  } catch (err) { next(err); }
};

const searchSuspectByFace = async (req, res, next) => {
  try {
    const { face_image } = req.body;
    if (!face_image) {
      return res.status(400).json({ success: false, message: 'face_image is required.' });
    }

    const biometricKey = getFaceKeyFromDataImage(face_image);
    const [[row]] = await db.query(`
      SELECT s.*, (SELECT COUNT(*) FROM case_criminals cs WHERE cs.criminal_id = s.id) AS case_count
      FROM criminals s
      WHERE s.fingerprint_hash = ?
      GROUP BY s.id
      LIMIT 1
    `, [biometricKey]);

    if (!row) {
      return res.json({ success: true, match: false, data: null });
    }

    const [cases] = await db.query(
      `SELECT c.id, c.ob_number, COALESCE(c.title, c.case_title) AS title, c.status, c.priority, c.created_at, cs.role_in_case
       FROM cases c
       JOIN case_criminals cs ON c.id = cs.case_id
       WHERE cs.criminal_id = ?
       ORDER BY c.created_at DESC`,
      [row.id]
    );

    res.json({ success: true, match: true, data: { ...row, cases } });
  } catch (err) { next(err); }
};

const searchAndMatch = async (req, res, next) => {
  try {
    const {
      name,
      mother_name,
      phone,
      national_id,
      previous_case_number,
      police_station,
      date_of_birth,
      face_image,
      limit = 50,
    } = req.body;

    const faceKey = face_image ? getFaceKeyFromDataImage(face_image) : null;
    const params = [];
    const scopeWhere = buildScopedCaseJoinWhere(req.user, params, 'c');
    const filters = [];
    const filterParams = [];

    if (name) {
      filters.push('(s.full_name LIKE ? OR s.alias LIKE ?)');
      filterParams.push(`%${name}%`, `%${name}%`);
    }
    if (mother_name) {
      filters.push('s.mother_name LIKE ?');
      filterParams.push(`%${mother_name}%`);
    }
    if (phone) {
      filters.push('s.phone LIKE ?');
      filterParams.push(`%${phone}%`);
    }
    if (national_id) {
      filters.push('s.id_number = ?');
      filterParams.push(national_id);
    }
    if (date_of_birth) {
      filters.push('s.date_of_birth = ?');
      filterParams.push(date_of_birth);
    }
    if (previous_case_number) {
      filters.push('c.ob_number LIKE ?');
      filterParams.push(`%${previous_case_number}%`);
    }
    if (police_station) {
      filters.push('(d.district_name LIKE ? OR d.district_code LIKE ?)');
      filterParams.push(`%${police_station}%`, `%${police_station}%`);
    }
    if (faceKey) {
      filters.push('s.fingerprint_hash = ?');
      filterParams.push(faceKey);
    }

    if (!filters.length) {
      return res.status(400).json({ success: false, message: 'Provide at least one search field.' });
    }

    const nameLike = `%${name || ''}%`;
    const motherLike = `%${mother_name || ''}%`;
    const caseLike = `%${previous_case_number || ''}%`;
    const stationLike = `%${police_station || ''}%`;
    const selectParams = [
      faceKey || '',
      national_id || '',
      phone || '',
      date_of_birth || '',
      name ? 1 : 0, nameLike, nameLike,
      mother_name ? 1 : 0, motherLike,
      previous_case_number ? 1 : 0, caseLike,
      police_station ? 1 : 0, stationLike, stationLike,
    ];

    const [rows] = await db.query(`
      SELECT s.id, s.full_name, s.mother_name, s.alias, s.gender, s.date_of_birth, s.age,
             s.nationality, s.id_number, s.phone, s.address, s.photo_url, s.fingerprint_hash,
             s.is_arrested,
             COUNT(DISTINCT c.id) AS case_count,
             COUNT(DISTINCT a.id) AS arrest_count,
             MAX(c.created_at) AS last_case_date,
             GROUP_CONCAT(DISTINCT c.ob_number ORDER BY c.created_at DESC SEPARATOR ', ') AS previous_case_numbers,
             GROUP_CONCAT(DISTINCT d.district_name ORDER BY d.district_name SEPARATOR ', ') AS police_stations,
             MAX(CASE WHEN s.fingerprint_hash = ? AND s.fingerprint_hash IS NOT NULL THEN 1 ELSE 0 END) AS face_match,
             MAX(CASE WHEN s.id_number = ? AND s.id_number IS NOT NULL THEN 1 ELSE 0 END) AS national_id_match,
             MAX(CASE WHEN s.phone = ? AND s.phone IS NOT NULL THEN 1 ELSE 0 END) AS phone_match,
             MAX(CASE WHEN s.date_of_birth = ? AND s.date_of_birth IS NOT NULL THEN 1 ELSE 0 END) AS dob_match,
             MAX(CASE WHEN ? = 1 AND (s.full_name LIKE ? OR s.alias LIKE ?) THEN 1 ELSE 0 END) AS name_match,
             MAX(CASE WHEN ? = 1 AND s.mother_name LIKE ? THEN 1 ELSE 0 END) AS mother_name_match,
             MAX(CASE WHEN ? = 1 AND c.ob_number LIKE ? THEN 1 ELSE 0 END) AS previous_case_match,
             MAX(CASE WHEN ? = 1 AND (d.district_name LIKE ? OR d.district_code LIKE ?) THEN 1 ELSE 0 END) AS station_match
      FROM criminals s
      LEFT JOIN case_criminals cs ON cs.criminal_id = s.id
      LEFT JOIN cases c ON c.id = cs.case_id
      LEFT JOIN arrests a ON a.suspect_id = s.id
      LEFT JOIN districts d ON d.id = c.district_id
      WHERE ${scopeWhere}
        AND (${filters.join(' OR ')})
      GROUP BY s.id
      ORDER BY
        face_match DESC,
        national_id_match DESC,
        phone_match DESC,
        dob_match DESC,
        name_match DESC,
        mother_name_match DESC,
        previous_case_match DESC,
        station_match DESC,
        arrest_count DESC,
        case_count DESC,
        s.full_name ASC
      LIMIT ?
    `, [
      ...selectParams,
      ...params,
      ...filterParams,
      Math.min(Number(limit) || 50, 100),
    ]);

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        match_reasons: [
          Number(row.face_match) === 1 ? 'face_image' : null,
          Number(row.national_id_match) === 1 ? 'national_id' : null,
          Number(row.phone_match) === 1 ? 'phone' : null,
          Number(row.dob_match) === 1 ? 'date_of_birth' : null,
          Number(row.name_match) === 1 ? 'name' : null,
          Number(row.mother_name_match) === 1 ? 'mother_name' : null,
          Number(row.previous_case_match) === 1 ? 'previous_case_number' : null,
          Number(row.station_match) === 1 ? 'police_station' : null,
        ].filter(Boolean),
      })),
    });
  } catch (err) { next(err); }
};

const loadSuspectHistory = async (suspectId) => {
  const [[profile]] = await db.query(`
    SELECT s.*, (SELECT COUNT(*) FROM case_criminals cs WHERE cs.criminal_id = s.id) AS case_count, COUNT(DISTINCT a.id) AS arrest_count
    FROM criminals s
    LEFT JOIN arrests a ON s.id = a.suspect_id
    WHERE s.id = ?
    GROUP BY s.id
  `, [suspectId]);

  if (!profile) return null;

  const [arrests] = await db.query(`
    SELECT a.*,
           COALESCE(c.title, c.case_title) AS case_title,
           c.ob_number,
           c.status AS case_status,
           c.priority,
           c.incident_date,
           c.incident_location,
           c.description AS case_description,
           d.district_name AS police_station_name,
           ci.city_name,
           r.region_name,
           sa.state_name,
           COALESCE(u.full_name, a.arrested_by) AS arrested_by_name
    FROM arrests a
    JOIN cases c ON c.id = a.case_id
    LEFT JOIN districts d ON COALESCE(a.police_station_id, c.district_id) = d.id
    LEFT JOIN cities ci ON c.city_id = ci.id
    LEFT JOIN regions r ON c.region_id = r.id
    LEFT JOIN state_administrations sa ON c.state_administration_id = sa.id
    LEFT JOIN users u ON a.arrested_by = CAST(u.id AS CHAR) OR a.arrested_by = u.username
    WHERE a.suspect_id = ?
    ORDER BY a.arrest_date ASC
  `, [suspectId]);

  const [cases] = await db.query(`
    SELECT c.id, c.ob_number, COALESCE(c.title, c.case_title) AS title, c.case_type, c.status, c.priority,
           c.incident_date, c.incident_location, cs.role_in_case, cs.notes,
           d.district_name AS police_station_name
    FROM case_criminals cs
    JOIN cases c ON c.id = cs.case_id
    LEFT JOIN districts d ON c.district_id = d.id
    WHERE cs.criminal_id = ?
    ORDER BY c.created_at ASC
  `, [suspectId]);

  const [actions] = await db.query(`
    SELECT ca.*
    FROM case_actions ca
    JOIN case_criminals cs ON ca.case_id = cs.case_id
    WHERE cs.criminal_id = ?
    ORDER BY ca.created_at ASC
  `, [suspectId]);
  const [biometrics] = await db.query('SELECT * FROM biometric_identifiers WHERE suspect_id = ? ORDER BY captured_at DESC', [suspectId]);
  const [documents] = await db.query('SELECT * FROM prisoner_documents WHERE suspect_id = ? ORDER BY uploaded_at DESC', [suspectId]);
  const [prison_transfers] = await db.query('SELECT * FROM prison_transfers WHERE suspect_id = ? ORDER BY transfer_date DESC', [suspectId]);
  const [medical_records] = await db.query('SELECT * FROM prisoner_medical_records WHERE suspect_id = ? ORDER BY record_date DESC', [suspectId]);
  const [visitor_logs] = await db.query('SELECT * FROM prisoner_visitor_logs WHERE suspect_id = ? ORDER BY visit_date DESC', [suspectId]);
  const [release_approvals] = await db.query('SELECT * FROM release_approvals WHERE suspect_id = ? ORDER BY requested_at DESC', [suspectId]);

  const hydratedArrests = hydrateArrests(arrests);
  const dueForRelease = hydratedArrests.filter((row) => row.release_due);
  const wantedOrEscaped = hydratedArrests.filter((row) => ['wanted', 'escaped'].includes(row.sentence_status));

  return {
    profile,
    first_arrest_date: hydratedArrests[0]?.arrest_date || null,
    repeat_offender: hydratedArrests.length > 1 || cases.length > 1,
    release_alerts: dueForRelease.map((row) => ({
      arrest_id: row.id,
      case_id: row.case_id,
      ob_number: row.ob_number,
      expected_release_date: row.expected_release_date,
      message: `${profile.full_name} has completed the expected sentence for ${row.ob_number} and should be reviewed for release.`,
    })),
    wanted_or_escaped: wantedOrEscaped,
    arrests: hydratedArrests,
    cases,
    actions,
    biometrics,
    documents,
    prison_transfers,
    medical_records,
    visitor_logs,
    release_approvals,
  };
};

const getSuspectHistory = async (req, res, next) => {
  try {
    const history = await loadSuspectHistory(req.params.id);
    if (!history) return res.status(404).json({ success: false, message: 'Suspect not found.' });
    res.json({ success: true, data: history });
  } catch (err) { next(err); }
};

const getSuspectReport = async (req, res, next) => {
  try {
    const history = await loadSuspectHistory(req.params.id);
    if (!history) return res.status(404).json({ success: false, message: 'Suspect not found.' });
    res.json({
      success: true,
      data: {
        generated_at: new Date().toISOString(),
        report_title: `Complete Prisoner/Suspect Record - ${history.profile.full_name}`,
        ...history,
      },
    });
  } catch (err) { next(err); }
};

const getSentenceAlerts = async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT a.id AS arrest_id, a.suspect_id, s.full_name AS suspect_name,
             a.case_id, COALESCE(c.title, c.case_title) AS case_title, c.ob_number,
             a.sentence_start_date, a.expected_release_date, a.sentence_status,
             d.district_name AS police_station_name
      FROM arrests a
      JOIN criminals s ON s.id = a.suspect_id
      JOIN cases c ON c.id = a.case_id
      LEFT JOIN districts d ON COALESCE(a.police_station_id, c.district_id) = d.id
      WHERE a.expected_release_date <= CURDATE()
        AND a.sentence_status IN ('sentenced','serving','release_review')
      ORDER BY a.expected_release_date ASC
    `);

    res.json({
      success: true,
      data: rows.map((row) => ({
        ...row,
        ...sentenceMetrics(row),
        message: `${row.suspect_name} has completed the expected sentence for ${row.ob_number} and should be reviewed for release.`,
      })),
    });
  } catch (err) { next(err); }
};

module.exports = {
  getcriminals,
  getSuspectById,
  getSuspectHistory,
  getSuspectReport,
  getSentenceAlerts,
  searchSuspectByFace,
  searchAndMatch,
  createSuspect,
  updateSuspect,
  releaseSuspect,
  checkDuplicate,
};
