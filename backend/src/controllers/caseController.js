// src/controllers/caseController.js
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { generateOBNumber } = require('../utils/obNumberGenerator');
const { generateCaseNumber } = require('../utils/caseNumberGenerator');
const { buildScopeWhere, getUserLocation } = require('../utils/locationScope');
const { ensureCourtCaseForPoliceCase } = require('../services/courtService');
const { ensureCidCaseForPoliceCase } = require('../services/cidService');

const CASE_STATUS_FLOW = {
  draft: ['registered'],
  registered: ['under_investigation'],
  CASE_REGISTERED: ['under_investigation'],
  pending_commander_review: ['registered'],
  confirmed_by_ward_commander: ['under_investigation'],
  under_investigation: ['referred_to_cid', 'ready_for_court', 'forwarded_to_court'],
  referred_to_cid: ['under_investigation', 'ready_for_court', 'forwarded_to_court', 'approved_for_court'],
  referred_cid: ['under_investigation', 'ready_for_court', 'forwarded_to_court', 'approved_for_court'],
  ready_for_court: ['forwarded_to_court', 'approved_for_court'],
  forwarded_to_court: ['approved_for_court', 'court_decided'],
  approved_for_court: ['court_decided'],
  referred_to_court: ['court_decided'],
  court_decided: ['closed'],
  closed: ['archived'],
  archived: [],
};

const getAllowedNextStatuses = (status) => CASE_STATUS_FLOW[status || 'draft'] || CASE_STATUS_FLOW.draft;

const canTransitionStatus = (fromStatus, toStatus) => {
  if (!toStatus || fromStatus === toStatus) return true;
  return getAllowedNextStatuses(fromStatus).includes(toStatus);
};

const mapLegacyStatus = (status) => {
  const legacy = {
    CASE_REGISTERED: 'registered',
    confirmed_by_ward_commander: 'registered',
    referred_cid: 'referred_to_cid',
    assigned_to_cid: 'referred_to_cid',
    Assigned_To_CID: 'referred_to_cid',
    ASSIGNED_TO_CID: 'referred_to_cid',
    Ready_For_Court: 'ready_for_court',
    READY_FOR_COURT: 'ready_for_court',
    Forwarded_To_Court: 'forwarded_to_court',
    FORWARDED_TO_COURT: 'forwarded_to_court',
    referred_to_court: 'approved_for_court',
  };
  return legacy[status] || status;
};

const validateIncidentDate = (incidentDate) => {
  if (!incidentDate) return null;
  const parsed = new Date(incidentDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'Incident date/time is invalid.';
  }
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  if (parsed.getTime() > oneHourAgo) {
    return 'Incident date/time must be at least one hour in the past.';
  }
  return null;
};

const getScopedCaseById = async (user, caseId, columns = 'c.*') => {
  const scope = buildScopeWhere(user, 'c');
  const [[row]] = await db.query(
    `SELECT ${columns}
     FROM cases c
     WHERE c.id = ? AND ${scope.clause}`,
    [caseId, ...scope.params]
  );
  return row || null;
};

const buildAssignableOfficerScope = (user) => {
  const params = [];
  const role = String(user?.role || '').toLowerCase();
  if (!user || role === 'admin') return { clause: '1=1', params };

  const { scopeType, scopeId } = user;
  if (!scopeType || !scopeId) return { clause: '1=0', params };

  if (scopeType === 'district') {
    params.push('District', scopeId);
    return {
      clause: `EXISTS (
        SELECT 1 FROM officer_assignments oa
        WHERE oa.officer_id = po.id
          AND oa.is_current = 1
          AND oa.assignment_type = ?
          AND oa.assignment_id = ?
      )`,
      params,
    };
  }

  if (scopeType === 'city') {
    params.push('City', scopeId, scopeId);
    return {
      clause: `EXISTS (
        SELECT 1 FROM officer_assignments oa
        LEFT JOIN districts d ON oa.assignment_type = 'District' AND oa.assignment_id = d.id
        WHERE oa.officer_id = po.id
          AND oa.is_current = 1
          AND ((oa.assignment_type = ? AND oa.assignment_id = ?) OR d.city_id = ?)
      )`,
      params,
    };
  }

  if (scopeType === 'region') {
    params.push('Region', scopeId, scopeId, scopeId);
    return {
      clause: `EXISTS (
        SELECT 1 FROM officer_assignments oa
        LEFT JOIN cities ci ON oa.assignment_type = 'City' AND oa.assignment_id = ci.id
        LEFT JOIN districts d ON oa.assignment_type = 'District' AND oa.assignment_id = d.id
        LEFT JOIN cities dci ON d.city_id = dci.id
        WHERE oa.officer_id = po.id
          AND oa.is_current = 1
          AND ((oa.assignment_type = ? AND oa.assignment_id = ?) OR ci.region_id = ? OR dci.region_id = ?)
      )`,
      params,
    };
  }

  return { clause: '1=0', params };
};

const buildLinkedObScopeExists = (user) => {
  const params = [];
  const role = String(user?.role || '').toLowerCase();
  if (!user || role === 'admin') return { clause: '1=1', params };

  const source = user.location || user;
  if (source.districtId || source.district_id || user.scopeType === 'district') {
    params.push(source.districtId || source.district_id || user.scopeId);
    return { clause: 'scoped_ob.district_id = ?', params };
  }
  if (source.cityId || source.city_id || user.scopeType === 'city') {
    params.push(source.cityId || source.city_id || user.scopeId);
    return { clause: 'od.city_id = ?', params };
  }
  if (source.regionId || source.region_id || user.scopeType === 'region') {
    params.push(source.regionId || source.region_id || user.scopeId);
    return { clause: 'scoped_ob.region_id = ?', params };
  }
  if (source.stateId || source.state_administration_id || user.scopeType === 'state_administration') {
    params.push(source.stateId || source.state_administration_id || user.scopeId);
    return { clause: 'scoped_ob.state_administration_id = ?', params };
  }

  return { clause: '1=0', params };
};

/** GET /api/cases — List cases */
const getCases = async (req, res, next) => {
  try {
    const { status, priority, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const scope = buildScopeWhere(req.user, 'c');
    let whereClause = scope.clause;
    const params = [...scope.params];

    if (status) { whereClause += ' AND c.status = ?'; params.push(status); }
    if (priority) { whereClause += ' AND c.priority = ?'; params.push(priority); }
    if (search) {
      whereClause += ' AND (c.ob_number LIKE ? OR c.title LIKE ? OR c.incident_location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await db.query(
      `SELECT c.id, c.case_number, c.ob_number, c.title, c.status, c.priority,
              c.incident_date, c.incident_location, c.created_at,
              c.original_ob_staff_name, p.full_name AS officer_name
       FROM cases c
       LEFT JOIN police_officers p ON c.assigned_officer_id = p.id
       WHERE ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM cases c WHERE ${whereClause}`, params
    );

    res.json({ success: true, data: rows, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) } });
  } catch (err) { next(err); }
};

/** GET /api/cases/:id — Full case details */
const getCaseById = async (req, res, next) => {
  try {
    const caseId = req.params.id;
    const scope = buildScopeWhere(req.user, 'c');
    const linkedObScope = buildLinkedObScopeExists(req.user);

    const [[caseRow]] = await db.query(
      `SELECT c.*,
              COALESCE(c.title, c.case_title) AS title,
              o.full_name AS officer_name,
              o.force_number AS officer_badge,
              ob.registration_date AS ob_registration_date,
              ob.registration_time AS ob_registration_time,
              ob.registered_by_name AS ob_registered_by_name,
              ob.registered_by_role AS ob_registered_by_role,
              sa.state_name,
              r.region_name,
              ci.city_name,
              d.district_name,
              d.district_name AS station_name
       FROM cases c
       LEFT JOIN police_officers o ON c.assigned_officer_id = o.id
       LEFT JOIN ob_entries ob ON c.ob_entry_id = ob.id
       LEFT JOIN state_administrations sa ON c.state_administration_id = sa.id
       LEFT JOIN regions r ON c.region_id = r.id
       LEFT JOIN cities ci ON c.city_id = ci.id
       LEFT JOIN districts d ON c.district_id = d.id
       WHERE c.id = ?
         AND (
           ${scope.clause}
           OR EXISTS (
             SELECT 1
             FROM ob_entries scoped_ob
             LEFT JOIN districts od ON od.id = scoped_ob.district_id
             WHERE scoped_ob.ob_number = c.ob_number
               AND ${linkedObScope.clause}
           )
         )`,
      [caseId, ...scope.params, ...linkedObScope.params]
    );
    if (!caseRow) return res.status(404).json({ success: false, message: 'Case not found.' });

    const [criminals] = await db.query(
      `SELECT s.*, cs.role_in_case, cs.notes AS case_notes, cs.linked_at, cs.linked_by_user_id,
              cs.status AS link_status,
              COALESCE(s.face_capture_image, s.offender_photo, s.photo_url) AS face_image,
              CASE WHEN s.face_capture_image IS NOT NULL OR s.offender_photo IS NOT NULL OR s.photo_url IS NOT NULL
                   THEN 'Captured' ELSE 'Not Captured' END AS face_capture_status,
              (SELECT COUNT(*) FROM case_criminals csh WHERE csh.criminal_id = s.id) AS previous_case_count
       FROM criminals s
       JOIN case_criminals cs ON s.id = cs.criminal_id
       WHERE cs.case_id = ?
       ORDER BY cs.linked_at DESC`,
      [caseId]
    );
    const [victims] = await db.query(`SELECT v.* FROM victims v JOIN case_victims cv ON v.id = cv.victim_id WHERE cv.case_id = ?`, [caseId]);
    const [evidence] = await db.query(`SELECT * FROM evidence WHERE case_id = ?`, [caseId]);
    const [actions] = await db.query(`SELECT * FROM case_actions WHERE case_id = ? ORDER BY created_at DESC`, [caseId]);
    const [referrals] = await db.query(`SELECT * FROM referrals WHERE case_id = ? ORDER BY referred_at DESC`, [caseId]);
    const [witnesses] = await db.query(
      `SELECT w.*, ws.statement, ws.statement_date, ws.taken_by
       FROM witnesses w
       JOIN witness_statements ws ON w.id = ws.witness_id
       WHERE ws.case_id = ?
       ORDER BY ws.created_at DESC`,
      [caseId]
    );

    res.json({
      success: true,
      data: {
        ...caseRow,
        criminals,
        suspects: criminals,
        victims,
        evidence,
        actions,
        referrals,
        witnesses,
        allowed_next_statuses: getAllowedNextStatuses(caseRow.status),
      },
    });
  } catch (err) { next(err); }
};

/** POST /api/cases — Register new case */
const createCase = async (req, res, next) => {
  try {
    let {
      title, description, incident_date, incident_location, priority, assigned_officer_id, status,
      state_administration_id, region_id, city_id, district_id, ob_entry_id,
      case_type, incident_type, complainant_name, complainant_phone, victim_name
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Case title is required.' });
    const incidentDateError = validateIncidentDate(incident_date);
    if (incidentDateError) return res.status(400).json({ success: false, message: incidentDateError });

    const offenderName = req.body.offender_name;
    const offenderFaceImage = req.body.offender_face_image;
    if (offenderName && !offenderFaceImage) {
      return res.status(400).json({ success: false, message: 'Offender face image is required when registering an offender.' });
    }

    let ob = null;
    if (ob_entry_id) {
      [[ob]] = await db.query('SELECT * FROM ob_entries WHERE id = ?', [ob_entry_id]);
      if (!ob) return res.status(404).json({ success: false, message: 'OB entry not found.' });

      const obScope = buildScopeWhere(req.user, 'ob');
      const [[allowedOb]] = await db.query(
        `SELECT ob.id FROM ob_entries ob WHERE ob.id = ? AND ${obScope.clause}`,
        [ob_entry_id, ...obScope.params]
      );
      if (!allowedOb) {
        return res.status(403).json({ success: false, message: 'You cannot create a case from an OB entry outside your station scope.' });
      }

      const [[existingCase]] = await db.query('SELECT id, case_number FROM cases WHERE ob_entry_id = ? LIMIT 1', [ob_entry_id]);
      if (existingCase || ['CONVERTED_TO_CASE', 'CASE_OPENED'].includes(ob.status)) {
        return res.status(409).json({
          success: false,
          message: 'This OB has already been converted to a case.',
          caseId: existingCase?.id || null,
          caseNumber: existingCase?.case_number || null,
        });
      }
    }

    const obNumber = ob?.ob_number || await generateOBNumber();
    const caseNumber = await generateCaseNumber();
    const location = await getUserLocation(req.user);
    
    state_administration_id = ob?.state_administration_id || location.state_administration_id || state_administration_id || null;
    region_id = ob?.region_id || location.region_id || region_id || null;
    city_id = location.city_id || city_id || null;
    district_id = ob?.district_id || location.district_id || district_id || null;
    incident_type = incident_type || ob?.incident_type || title;
    incident_location = incident_location || ob?.incident_location || null;
    description = description || ob?.description || null;
    complainant_name = complainant_name || ob?.reported_by || null;
    complainant_phone = complainant_phone || ob?.reporter_phone || null;

    const [result] = await db.query(
      `INSERT INTO cases (case_number, ob_number, title, case_title, case_type, incident_type,
                          complainant_name, complainant_phone, victim_name,
                          description, incident_date, incident_location, priority, 
                          state_administration_id, region_id, city_id, district_id, 
                          assigned_officer_id, created_by, status, ob_entry_id,
                          original_ob_staff_id, original_ob_staff_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [caseNumber, obNumber, title, title, case_type || null, incident_type || null,
      complainant_name || null, complainant_phone || null, victim_name || null,
      description || null, incident_date || null, incident_location || null, priority || 'medium',
      state_administration_id || null, region_id || null, city_id || null, district_id || null,
      assigned_officer_id || null, req.user.username, status || (ob ? 'CASE_REGISTERED' : 'draft'), ob_entry_id || null,
      ob?.registered_by_user_id || (req.user.role === 'ob_staff' ? req.user.id : null),
      ob?.registered_by_name || (req.user.role === 'ob_staff' ? (req.user.fullName || req.user.username) : null)]
    );

    const caseId = result.insertId;

    let faceCapture = null;
    if (offenderFaceImage) {
      const { parseFaceImage } = require('../utils/faceBiometric');
      const crypto = require('crypto');
      const fs = require('fs');
      const path = require('path');

      const parsedFace = parseFaceImage(offenderFaceImage);
      const faceKey = parsedFace.biometricKey;

      const [[existingCriminal]] = await db.query(
        'SELECT id FROM criminals WHERE fingerprint_hash = ? LIMIT 1',
        [faceKey]
      );

      if (existingCriminal) {
        await db.query(
          `INSERT IGNORE INTO case_criminals (case_id, criminal_id, linked_by_user_id, role_in_case, notes, added_by)
           VALUES (?, ?, ?, 'Suspect', ?, ?)`,
          [
            caseId,
            existingCriminal.id,
            req.user.username,
            'Linked by facial match during case registration.',
            req.user.username
          ]
        );
        faceCapture = {
          suspectId: existingCriminal.id,
          matchedExisting: true
        };
      } else {
        const uploadDir = path.join(__dirname, '../../uploads/offenders');
        fs.mkdirSync(uploadDir, { recursive: true });
        const filename = `face-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${parsedFace.extension}`;
        fs.writeFileSync(path.join(uploadDir, filename), parsedFace.buffer, { mode: 0o600 });
        const faceCaptureUrl = `/uploads/offenders/${filename}`;

        const [criminalResult] = await db.query(
          `INSERT INTO criminals (full_name, face_capture_image, fingerprint_hash, nationality, arrest_status, is_arrested)
           VALUES (?, ?, ?, 'Somali', 'not_arrested', 0)`,
          [offenderName || 'Unknown Offender', faceCaptureUrl, faceKey]
        );
        const newCriminalId = criminalResult.insertId;

        const { writeAuditLog } = require('../utils/auditLogger');
        await writeAuditLog({
          userId: req.user.username || req.user.id,
          userEmail: req.user.email,
          action: 'CREATE_SUSPECT',
          entityType: 'criminals',
          entityId: newCriminalId,
          newData: { full_name: offenderName || 'Unknown Offender', face_capture_image: faceCaptureUrl, fingerprint_hash: faceKey }
        });

        await db.query(
          `INSERT INTO case_criminals (case_id, criminal_id, linked_by_user_id, role_in_case, added_by)
           VALUES (?, ?, ?, 'Suspect', ?)`,
          [caseId, newCriminalId, req.user.username, req.user.username]
        );

        faceCapture = {
          suspectId: newCriminalId,
          matchedExisting: false
        };
      }
    }

    await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after) VALUES (?, ?, ?, ?, ?)`,
      [caseId, req.user.username, ob ? 'CASE_CREATED_FROM_OB' : 'CASE_CREATED', ob ? `Case registered from ${ob.ob_number}.` : 'Case registered.', status || (ob ? 'CASE_REGISTERED' : 'draft')]);

    if (ob) {
      await db.query('UPDATE ob_entries SET status = ? WHERE id = ?', ['CONVERTED_TO_CASE', ob.id]);
    }

    await writeAuditLog({ userId: req.user.username, userEmail: req.user.email, action: 'CREATE_CASE', entityType: 'cases', entityId: caseId, newData: { caseNumber, obNumber, title } });

    res.status(201).json({ success: true, message: 'Case registered successfully.', caseId, caseNumber, obNumber, faceCapture });
  } catch (err) { next(err); }
};

/** GET /api/cases/my-assigned - Cases assigned to the logged-in officer */
const getMyAssignedCases = async (req, res, next) => {
  try {
    const scope = buildScopeWhere(req.user, 'c');
    const params = [...scope.params];
    const [rows] = await db.query(
      `SELECT c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
              c.status, c.priority, c.incident_date, c.incident_location, c.created_at,
              p.full_name AS officer_name
       FROM cases c
       LEFT JOIN police_officers p ON c.assigned_officer_id = p.id
       WHERE ${scope.clause}
         AND (
           c.assigned_officer_id = ?
           OR LOWER(p.email) = LOWER(?)
           OR LOWER(p.full_name) = LOWER(?)
         )
       ORDER BY c.created_at DESC`,
      [...params, req.user.id, req.user.email || '', req.user.fullName || '']
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** GET /api/cases/assignable/officers - Officers available for assignment */
const getAssignableOfficers = async (req, res, next) => {
  try {
    const officerScope = buildAssignableOfficerScope(req.user);
    const [rows] = await db.query(
      `SELECT po.id, po.full_name, po.force_number, po.phone, po.email, r.rank_name
       FROM police_officers po
       LEFT JOIN ranks r ON r.id = po.rank_id
       WHERE po.employment_status = 'active'
         AND ${officerScope.clause}
       ORDER BY po.full_name ASC`,
      officerScope.params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** PUT /api/cases/:id — Update case */
const updateCase = async (req, res, next) => {
  try {
    const { title, description, incident_date, incident_location, priority, status, assigned_officer_id } = req.body;
    const caseId = req.params.id;

    const existing = await getScopedCaseById(req.user, caseId);
    if (!existing) return res.status(404).json({ success: false, message: 'Case not found.' });
    const incidentDateError = validateIncidentDate(incident_date);
    if (incidentDateError) return res.status(400).json({ success: false, message: incidentDateError });
    const nextStatus = status ? mapLegacyStatus(status) : status;
    const isUserAdmin = req.user && (req.user.role === 'admin' || req.user.role?.toLowerCase() === 'admin' || req.user.username === 'admin@police.so');
    if (nextStatus && !isUserAdmin && !canTransitionStatus(existing.status, nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from ${existing.status} to ${nextStatus}.`,
        allowedNextStatuses: getAllowedNextStatuses(existing.status),
      });
    }

    await db.query(
      `UPDATE cases SET title=?, description=?, incident_date=?, incident_location=?, priority=?, status=?, assigned_officer_id=? WHERE id=?`,
      [title || existing.title, description || existing.description, incident_date || existing.incident_date,
       incident_location || existing.incident_location, priority || existing.priority, nextStatus || existing.status, 
       assigned_officer_id || existing.assigned_officer_id, caseId]
    );

    if (nextStatus && nextStatus !== existing.status) {
      await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after) VALUES (?, ?, ?, ?, ?, ?)`,
        [caseId, req.user.username, 'STATUS_UPDATED', `Status changed from ${existing.status} to ${nextStatus}`, existing.status, nextStatus]);
      await ensureCidCaseForPoliceCase(caseId, req.user.username);
      await ensureCourtCaseForPoliceCase(caseId, req.user.username);
    }

    await writeAuditLog({ userId: req.user.username, userEmail: req.user.email, action: 'UPDATE_CASE', entityType: 'cases', entityId: parseInt(caseId), newData: req.body });
    res.json({ success: true, message: 'Case updated.' });
  } catch (err) { next(err); }
};

/** PATCH /api/cases/:id/assign - Assign a case to an officer */
const assignCaseOfficer = async (req, res, next) => {
  try {
    const caseId = req.params.id;
    const { officer_id } = req.body;
    if (!officer_id) return res.status(400).json({ success: false, message: 'officer_id is required.' });

    const existing = await getScopedCaseById(req.user, caseId, 'c.id, c.assigned_officer_id, c.status');
    if (!existing) return res.status(404).json({ success: false, message: 'Case not found.' });

    const officerScope = buildAssignableOfficerScope(req.user);
    const [[officer]] = await db.query(
      `SELECT po.id, po.full_name, po.force_number
       FROM police_officers po
       WHERE po.id = ?
         AND po.employment_status = 'active'
         AND ${officerScope.clause}`,
      [officer_id, ...officerScope.params]
    );
    if (!officer) return res.status(404).json({ success: false, message: 'Officer not found.' });

    await db.query('UPDATE cases SET assigned_officer_id = ?, status = CASE WHEN status = ? THEN ? ELSE status END WHERE id = ?', [
      officer.id,
      'draft',
      'registered',
      caseId,
    ]);
    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after)
       VALUES (?, ?, 'CASE_ASSIGNED', ?, ?, ?)`,
      [caseId, req.user.username, `Assigned to ${officer.full_name} (${officer.force_number}).`, existing.status, existing.status === 'draft' ? 'registered' : existing.status]
    );
    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email,
      action: 'ASSIGN_CASE',
      entityType: 'cases',
      entityId: Number(caseId),
      oldData: { assigned_officer_id: existing.assigned_officer_id },
      newData: { assigned_officer_id: officer.id },
    });

    res.json({ success: true, message: 'Case assigned successfully.', officer });
  } catch (err) {
    next(err);
  }
};

/** GET /api/cases/:id/export - printable case package data */
const exportCasePackage = async (req, res, next) => {
  try {
    const caseId = req.params.id;
    const scope = buildScopeWhere(req.user, 'c');
    const [[caseRow]] = await db.query(
      `SELECT c.*,
              COALESCE(c.title, c.case_title) AS title,
              po.full_name AS officer_name,
              d.district_name AS station_name,
              sa.state_name,
              r.region_name
       FROM cases c
       LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
       LEFT JOIN state_administrations sa ON sa.id = c.state_administration_id
       LEFT JOIN regions r ON r.id = c.region_id
       LEFT JOIN districts d ON d.id = c.district_id
       WHERE c.id = ? AND ${scope.clause}`,
      [caseId, ...scope.params]
    );
    if (!caseRow) return res.status(404).json({ success: false, message: 'Case not found.' });

    const [criminals] = await db.query(
      `SELECT s.full_name, s.phone, s.gender, s.arrest_status, cs.role_in_case
       FROM criminals s JOIN case_criminals cs ON cs.criminal_id = s.id
       WHERE cs.case_id = ?`,
      [caseId]
    );
    const [evidence] = await db.query('SELECT title, type, collection_date, location_found, file_url FROM evidence WHERE case_id = ?', [caseId]);
    const [actions] = await db.query('SELECT action_type, performed_by, description, status_before, status_after, created_at FROM case_actions WHERE case_id = ? ORDER BY created_at ASC', [caseId]);

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        generatedBy: req.user.username,
        case: caseRow,
        criminals,
        evidence,
        timeline: actions,
        templates: {
          caseSummary: true,
          arrestWarrant: criminals.length > 0,
          courtReferral: ['approved_for_court', 'court_decided', 'closed', 'referred_to_court'].includes(caseRow.status),
          releaseCertificate: ['closed', 'court_decided'].includes(caseRow.status),
          evidenceReceipt: evidence.length > 0,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/cases/:id/court-decision - Court outcomes are handled outside this police system */
const recordCourtDecision = async (req, res) => {
  return res.status(410).json({
    success: false,
    message: 'Court judgment, sentencing, prison transfer, and appeal processes are not managed here. Use Court Referral only.',
  });
};

/** GET /api/cases/stats — Dashboard stats */
const getCaseStats = async (req, res, next) => {
  try {
    const scope = buildScopeWhere(req.user, 'c');
    const whereClause = scope.clause;
    const params = [...scope.params];
    
    const [[stats]] = await db.query(
      `SELECT COUNT(*) AS \`total\`,
              SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS \`draft\`,
              SUM(CASE WHEN status='pending_commander_review' THEN 1 ELSE 0 END) AS \`pending_review\`,
              SUM(CASE WHEN status='confirmed_by_ward_commander' THEN 1 ELSE 0 END) AS \`confirmed\`,
              SUM(CASE WHEN status IN ('confirmed_by_ward_commander', 'under_investigation', 'referred_cid', 'transferred', 'reassigned') THEN 1 ELSE 0 END) AS \`active\`,
              SUM(CASE WHEN status='under_investigation' THEN 1 ELSE 0 END) AS \`under_investigation\`,
              SUM(CASE WHEN status='referred_cid' THEN 1 ELSE 0 END) AS \`referred_cid\`,
              SUM(CASE WHEN status='referred_to_court' THEN 1 ELSE 0 END) AS \`referred_to_court\`,
              SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS \`closed\`,
              SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS \`closed_cases\`
       FROM cases c WHERE ${whereClause}`,
      params
    );

    const [recentCases] = await db.query(
      `SELECT c.*, p.full_name AS \`officer_name\` 
       FROM cases c LEFT JOIN police_officers p ON c.assigned_officer_id = p.id 
       WHERE ${whereClause} ORDER BY c.created_at DESC LIMIT 5`,
      params
    );

    res.json({ success: true, data: { ...stats, recentCases } });
  } catch (err) { next(err); }
};

module.exports = { getCases, getMyAssignedCases, getAssignableOfficers, getCaseById, createCase, updateCase, assignCaseOfficer, exportCasePackage, recordCourtDecision, getCaseStats };

