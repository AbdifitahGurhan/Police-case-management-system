'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { generateOBNumber } = require('../utils/obNumberGenerator');
const { generateCaseNumber } = require('../utils/caseNumberGenerator');
const { buildScopeWhere, getUserLocation, normalizeRole } = require('../utils/locationScope');

const getObEntries = async (req, res, next) => {
  try {
    const { status, registered_by_user_id } = req.query;
    const scope = buildScopeWhere(req.user, 'ob');
    const params = [...scope.params];
    let whereClause = scope.clause;

    if (normalizeRole(req.user.role) === 'ob_staff') {
      whereClause += ' AND ob.registered_by_user_id = ?';
      params.push(req.user.id);
    } else if (registered_by_user_id) {
      whereClause += ' AND ob.registered_by_user_id = ?';
      params.push(registered_by_user_id);
    }
    if (status) {
      whereClause += ' AND ob.status = ?';
      params.push(status);
    }

    const [rows] = await db.query(
      `SELECT ob.*,
              sa.state_name,
              r.region_name,
              d.district_name AS district_police_station_name
       FROM ob_entries ob
       LEFT JOIN state_administrations sa ON ob.state_administration_id = sa.id
       LEFT JOIN regions r ON ob.region_id = r.id
       LEFT JOIN districts d ON ob.district_id = d.id
       WHERE ${whereClause}
       ORDER BY ob.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getObEntryById = async (req, res, next) => {
  try {
    const scope = buildScopeWhere(req.user, 'ob');
    const params = [req.params.id, ...scope.params];
    const [[row]] = await db.query(
      `SELECT ob.*,
              sa.state_name,
              r.region_name,
              d.district_name AS district_police_station_name,
              c.id AS linked_case_id,
              c.case_number AS linked_case_number,
              c.status AS linked_case_status
       FROM ob_entries ob
       LEFT JOIN state_administrations sa ON ob.state_administration_id = sa.id
       LEFT JOIN regions r ON ob.region_id = r.id
       LEFT JOIN districts d ON ob.district_id = d.id
       LEFT JOIN cases c ON c.ob_entry_id = ob.id OR c.ob_number = ob.ob_number
       WHERE ob.id = ? AND ${scope.clause}`,
      params
    );

    if (!row) return res.status(404).json({ success: false, message: 'OB entry not found.' });
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

const createObEntry = async (req, res, next) => {
  try {
    const { incident_type, incident_location, description, reported_by, reporter_phone } = req.body;
    if (!incident_type || !incident_location || !reported_by) {
      return res.status(400).json({ success: false, message: 'incident_type, incident_location, and reported_by are required.' });
    }

    const location = await getUserLocation(req.user);
    if (normalizeRole(req.user.role) !== 'admin' && !location.state_administration_id && !location.region_id && !location.district_id) {
      return res.status(400).json({ success: false, message: 'Your account has no assigned administrative location.' });
    }

    const now = new Date();
    let obNumber = null;
    let result = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      obNumber = await generateOBNumber();
      try {
        [result] = await db.query(
          `INSERT INTO ob_entries
            (ob_number, incident_type, incident_location, description, reported_by, reporter_phone,
             registered_by_user_id, registered_by_name, registered_by_role, registered_by_rank,
             state_administration_id, region_id, district_id,
             registration_date, registration_time, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OB_REGISTERED')`,
          [
            obNumber,
            incident_type,
            incident_location,
            description || null,
            reported_by,
            reporter_phone || null,
            req.user.id,
            req.user.fullName || req.user.username,
            req.user.roleCode || req.user.role,
            req.user.rank || null,
            location.state_administration_id || null,
            location.region_id || null,
            location.district_id || null,
            now.toISOString().slice(0, 10),
            now.toTimeString().slice(0, 8),
          ]
        );
        break;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY' || attempt === 2) throw err;
      }
    }

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'CREATE_OB_ENTRY',
      entityType: 'ob_entries',
      entityId: result.insertId,
      newData: { obNumber, incident_type, incident_location, location },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'OB entry registered.', obEntryId: result.insertId, obNumber });
  } catch (err) { next(err); }
};

const convertObToCase = async (req, res, next) => {
  let attemptedObNumber = null;
  try {
    const [[ob]] = await db.query(
      `SELECT ob.*, d.city_id
       FROM ob_entries ob
       LEFT JOIN districts d ON d.id = ob.district_id
       WHERE ob.id = ?`,
      [req.params.id]
    );
    if (!ob) return res.status(404).json({ success: false, message: 'OB entry not found.' });
    attemptedObNumber = ob.ob_number;
    const scope = buildScopeWhere(req.user, 'ob');
    if (scope.params.length) {
      const [[allowed]] = await db.query(`SELECT id FROM ob_entries ob WHERE ob.id = ? AND ${scope.clause}`, [ob.id, ...scope.params]);
      if (!allowed) return res.status(403).json({ success: false, message: 'You cannot convert an OB entry outside your location.' });
    }

    const [[existingCase]] = await db.query(
      `SELECT id, case_number
       FROM cases
       WHERE ob_entry_id = ? OR ob_number = ?
       ORDER BY id DESC
       LIMIT 1`,
      [ob.id, ob.ob_number]
    );
    if (existingCase) {
      if (!['CONVERTED_TO_CASE', 'CASE_OPENED'].includes(ob.status)) {
        await db.query('UPDATE ob_entries SET status = ? WHERE id = ?', ['CONVERTED_TO_CASE', ob.id]);
      }
      await db.query(
        `UPDATE cases
         SET ob_entry_id = COALESCE(ob_entry_id, ?),
             state_administration_id = COALESCE(?, state_administration_id),
             region_id = COALESCE(?, region_id),
             city_id = COALESCE(?, city_id),
             district_id = COALESCE(?, district_id)
         WHERE id = ?`,
        [
          ob.id,
          ob.state_administration_id || null,
          ob.region_id || null,
          ob.city_id || null,
          ob.district_id || null,
          existingCase.id,
        ]
      );
      return res.status(200).json({
        success: true,
        message: 'This OB already has a linked case.',
        caseId: existingCase.id,
        caseNumber: existingCase.case_number,
        obNumber: ob.ob_number,
        alreadyExists: true,
      });
    }

    const { assigned_staff_id, priority, status } = req.body;
    const caseNumber = await generateCaseNumber();
    const [result] = await db.query(
      `INSERT INTO cases
        (case_number, case_title, title, ob_number, ob_entry_id, original_ob_staff_id, original_ob_staff_name,
         incident_type, description, incident_location, status, priority, state_administration_id, region_id, city_id,
         district_id, assigned_officer_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseNumber,
        ob.incident_type,
        ob.incident_type,
        ob.ob_number,
        ob.id,
        ob.registered_by_user_id,
        ob.registered_by_name,
        ob.incident_type,
        ob.description,
        ob.incident_location,
        status || 'CASE_REGISTERED',
        priority || 'medium',
        ob.state_administration_id,
        ob.region_id,
        ob.city_id || null,
        ob.district_id,
        assigned_staff_id || null,
        req.user.username,
      ]
    );

    await db.query('UPDATE ob_entries SET status = ? WHERE id = ?', ['CONVERTED_TO_CASE', ob.id]);
    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
       VALUES (?, ?, 'CASE_OPENED_FROM_OB', ?, ?)`,
      [result.insertId, req.user.username, `Formal case opened from ${ob.ob_number}.`, status || 'CASE_REGISTERED']
    );

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'CONVERT_OB_TO_CASE',
      entityType: 'cases',
      entityId: result.insertId,
      newData: { caseNumber, obNumber: ob.ob_number, originalObStaffId: ob.registered_by_user_id },
    });

    res.status(201).json({ success: true, message: 'OB entry converted to case.', caseId: result.insertId, caseNumber, obNumber: ob.ob_number });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [[existingCase]] = await db.query(
        'SELECT id, case_number FROM cases WHERE ob_number = ? LIMIT 1',
        [attemptedObNumber || '']
      );
      return res.status(409).json({
        success: false,
        message: 'A case already exists for this OB number.',
        caseId: existingCase?.id || null,
        caseNumber: existingCase?.case_number || null,
      });
    }
    next(err);
  }
};

module.exports = { getObEntries, getObEntryById, createObEntry, convertObToCase };
