// src/controllers/caseController.js
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { generateOBNumber } = require('../utils/obNumberGenerator');
const { generateCaseNumber } = require('../utils/caseNumberGenerator');
const { buildScopeWhere, getUserLocation } = require('../utils/locationScope');

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
              n.neighborhood_name AS ward_name,
              n.neighborhood_name AS station_name
       FROM cases c
       LEFT JOIN police_officers o ON c.assigned_officer_id = o.id
       LEFT JOIN ob_entries ob ON c.ob_entry_id = ob.id
       LEFT JOIN state_administrations sa ON c.state_administration_id = sa.id
       LEFT JOIN regions r ON c.region_id = r.id
       LEFT JOIN cities ci ON c.city_id = ci.id
       LEFT JOIN districts d ON c.district_id = d.id
       LEFT JOIN neighborhoods n ON c.neighborhood_id = n.id
       WHERE c.id = ?`, [caseId]
    );
    if (!caseRow) return res.status(404).json({ success: false, message: 'Case not found.' });

    const [suspects] = await db.query(
      `SELECT s.*, cs.role_in_case, cs.notes AS case_notes, cs.linked_at, cs.linked_by_user_id,
              cs.status AS link_status,
              COALESCE(s.face_capture_image, s.offender_photo, s.photo_url) AS face_image,
              CASE WHEN s.face_capture_image IS NOT NULL OR s.offender_photo IS NOT NULL OR s.photo_url IS NOT NULL
                   THEN 'Captured' ELSE 'Not Captured' END AS face_capture_status,
              (SELECT COUNT(*) FROM case_suspects csh WHERE csh.suspect_id = s.id) AS previous_case_count
       FROM suspects s
       JOIN case_suspects cs ON s.id = cs.suspect_id
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

    res.json({ success: true, data: { ...caseRow, suspects, victims, evidence, actions, referrals, witnesses } });
  } catch (err) { next(err); }
};

/** POST /api/cases — Register new case */
const createCase = async (req, res, next) => {
  try {
    let {
      title, description, incident_date, incident_location, priority, assigned_officer_id, status,
      state_administration_id, region_id, city_id, district_id, neighborhood_id, ob_entry_id,
      case_type, incident_type, complainant_name, complainant_phone, victim_name
    } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Case title is required.' });
    const incidentDateError = validateIncidentDate(incident_date);
    if (incidentDateError) return res.status(400).json({ success: false, message: incidentDateError });

    let ob = null;
    if (ob_entry_id) {
      [[ob]] = await db.query('SELECT * FROM ob_entries WHERE id = ?', [ob_entry_id]);
      if (!ob) return res.status(404).json({ success: false, message: 'OB entry not found.' });

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
    district_id = ob?.district_id || location.district_id || district_id || null;
    neighborhood_id = ob?.neighborhood_id || location.neighborhood_id || neighborhood_id || null;
    incident_type = incident_type || ob?.incident_type || title;
    incident_location = incident_location || ob?.incident_location || null;
    description = description || ob?.description || null;
    complainant_name = complainant_name || ob?.reported_by || null;
    complainant_phone = complainant_phone || ob?.reporter_phone || null;

    const [result] = await db.query(
      `INSERT INTO cases (case_number, ob_number, title, case_title, case_type, incident_type,
                          complainant_name, complainant_phone, victim_name,
                          description, incident_date, incident_location, priority, 
                          state_administration_id, region_id, city_id, district_id, neighborhood_id, 
                          assigned_officer_id, created_by, status, ob_entry_id,
                          original_ob_staff_id, original_ob_staff_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [caseNumber, obNumber, title, title, case_type || null, incident_type || null,
      complainant_name || null, complainant_phone || null, victim_name || null,
      description || null, incident_date || null, incident_location || null, priority || 'medium',
      state_administration_id || null, region_id || null, city_id || null, district_id || null, neighborhood_id || null,
      assigned_officer_id || null, req.user.username, status || (ob ? 'CASE_REGISTERED' : 'draft'), ob_entry_id || null,
      ob?.registered_by_user_id || (req.user.role === 'ob_staff' ? req.user.id : null),
      ob?.registered_by_name || (req.user.role === 'ob_staff' ? (req.user.fullName || req.user.username) : null)]
    );

    const caseId = result.insertId;

    await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after) VALUES (?, ?, ?, ?, ?)`,
      [caseId, req.user.username, ob ? 'CASE_CREATED_FROM_OB' : 'CASE_CREATED', ob ? `Case registered from ${ob.ob_number}.` : 'Case registered.', status || (ob ? 'CASE_REGISTERED' : 'draft')]);

    if (ob) {
      await db.query('UPDATE ob_entries SET status = ? WHERE id = ?', ['CONVERTED_TO_CASE', ob.id]);
    }

    await writeAuditLog({ userId: req.user.username, userEmail: req.user.email, action: 'CREATE_CASE', entityType: 'cases', entityId: caseId, newData: { caseNumber, obNumber, title } });

    res.status(201).json({ success: true, message: 'Case registered successfully.', caseId, caseNumber, obNumber });
  } catch (err) { next(err); }
};

/** PUT /api/cases/:id — Update case */
const updateCase = async (req, res, next) => {
  try {
    const { title, description, incident_date, incident_location, priority, status, assigned_officer_id } = req.body;
    const caseId = req.params.id;

    const [[existing]] = await db.query('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Case not found.' });
    const incidentDateError = validateIncidentDate(incident_date);
    if (incidentDateError) return res.status(400).json({ success: false, message: incidentDateError });

    await db.query(
      `UPDATE cases SET title=?, description=?, incident_date=?, incident_location=?, priority=?, status=?, assigned_officer_id=? WHERE id=?`,
      [title || existing.title, description || existing.description, incident_date || existing.incident_date,
       incident_location || existing.incident_location, priority || existing.priority, status || existing.status, 
       assigned_officer_id || existing.assigned_officer_id, caseId]
    );

    if (status && status !== existing.status) {
      await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after) VALUES (?, ?, ?, ?, ?, ?)`,
        [caseId, req.user.username, 'STATUS_UPDATED', `Status changed from ${existing.status} to ${status}`, existing.status, status]);
    }

    await writeAuditLog({ userId: req.user.username, userEmail: req.user.email, action: 'UPDATE_CASE', entityType: 'cases', entityId: parseInt(caseId), newData: req.body });
    res.json({ success: true, message: 'Case updated.' });
  } catch (err) { next(err); }
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

module.exports = { getCases, getCaseById, createCase, updateCase, recordCourtDecision, getCaseStats };

