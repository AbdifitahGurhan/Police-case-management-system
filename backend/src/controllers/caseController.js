// src/controllers/caseController.js
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { generateOBNumber } = require('../utils/obNumberGenerator');
const { saveBlockchainRecord } = require('../utils/hashUtil');

/** GET /api/cases — List cases */
const getCases = async (req, res, next) => {
  try {
    const { status, priority, search, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let whereClause = '1=1';
    const params = [];

    // Role-based filtering
    if (req.user.scopeType === 'state_administration') {
      whereClause += ' AND c.state_administration_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'region') {
      whereClause += ' AND c.region_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'city') {
      whereClause += ' AND c.city_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'district') {
      whereClause += ' AND c.district_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'neighborhood') {
      whereClause += ' AND c.neighborhood_id = ?';
      params.push(req.user.scopeId);
    }

    if (status) { whereClause += ' AND c.status = ?'; params.push(status); }
    if (priority) { whereClause += ' AND c.priority = ?'; params.push(priority); }
    if (search) {
      whereClause += ' AND (c.ob_number LIKE ? OR c.title LIKE ? OR c.incident_location LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [rows] = await db.query(
      `SELECT c.id, c.ob_number, c.title, c.status, c.priority,
              c.incident_date, c.incident_location, c.created_at,
              p.full_name AS officer_name
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
      `SELECT c.*, o.full_name AS officer_name, o.force_number AS officer_badge
       FROM cases c
       LEFT JOIN police_officers o ON c.assigned_officer_id = o.id
       WHERE c.id = ?`, [caseId]
    );
    if (!caseRow) return res.status(404).json({ success: false, message: 'Case not found.' });

    const [suspects] = await db.query(`SELECT s.*, cs.role_in_case FROM suspects s JOIN case_suspects cs ON s.id = cs.suspect_id WHERE cs.case_id = ?`, [caseId]);
    const [victims] = await db.query(`SELECT v.* FROM victims v JOIN case_victims cv ON v.id = cv.victim_id WHERE cv.case_id = ?`, [caseId]);
    const [evidence] = await db.query(`SELECT * FROM evidence WHERE case_id = ?`, [caseId]);
    const [actions] = await db.query(`SELECT * FROM case_actions WHERE case_id = ? ORDER BY created_at DESC`, [caseId]);

    res.json({ success: true, data: { ...caseRow, suspects, victims, evidence, actions } });
  } catch (err) { next(err); }
};

/** POST /api/cases — Register new case */
const createCase = async (req, res, next) => {
  try {
    let { title, description, incident_date, incident_location, priority, assigned_officer_id, status,
          state_administration_id, region_id, city_id, district_id, neighborhood_id } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Case title is required.' });

    const obNumber = await generateOBNumber();
    
    // Automatically enforce scoping down to the creating unit's level
    if (req.user.scopeType === 'state_administration') state_administration_id = req.user.scopeId;
    if (req.user.scopeType === 'region') region_id = req.user.scopeId;
    if (req.user.scopeType === 'city') city_id = req.user.scopeId;
    if (req.user.scopeType === 'district') district_id = req.user.scopeId;
    if (req.user.scopeType === 'neighborhood') neighborhood_id = req.user.scopeId;

    const [result] = await db.query(
      `INSERT INTO cases (ob_number, title, description, incident_date, incident_location, priority, 
                          state_administration_id, region_id, city_id, district_id, neighborhood_id, 
                          assigned_officer_id, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [obNumber, title, description || null, incident_date || null, incident_location || null, priority || 'medium',
      state_administration_id || null, region_id || null, city_id || null, district_id || null, neighborhood_id || null,
      assigned_officer_id || null, req.user.username, status || 'DRAFT']
    );

    const caseId = result.insertId;

    await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after) VALUES (?, ?, ?, ?, ?)`,
      [caseId, req.user.username, 'CASE_CREATED', 'Case registered.', status || 'DRAFT']);

    await writeAuditLog({ userId: req.user.username, userEmail: req.user.email, action: 'CREATE_CASE', entityType: 'cases', entityId: caseId, newData: { obNumber, title } });

    res.status(201).json({ success: true, message: 'Case registered successfully.', caseId, obNumber });
  } catch (err) { next(err); }
};

/** PUT /api/cases/:id — Update case */
const updateCase = async (req, res, next) => {
  try {
    const { title, description, incident_date, incident_location, priority, status, assigned_officer_id } = req.body;
    const caseId = req.params.id;

    const [[existing]] = await db.query('SELECT * FROM cases WHERE id = ?', [caseId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Case not found.' });

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

/** GET /api/cases/stats — Dashboard stats */
const getCaseStats = async (req, res, next) => {
  try {
    let whereClause = '1=1';
    const params = [];

    // Role-based filtering
    if (req.user.scopeType === 'state_administration') {
      whereClause += ' AND c.state_administration_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'region') {
      whereClause += ' AND c.region_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'city') {
      whereClause += ' AND c.city_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'district') {
      whereClause += ' AND c.district_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'neighborhood') {
      whereClause += ' AND c.neighborhood_id = ?';
      params.push(req.user.scopeId);
    }
    
    const [[stats]] = await db.query(
      `SELECT COUNT(*) AS \`total\`,
              SUM(CASE WHEN status='DRAFT' THEN 1 ELSE 0 END) AS \`draft\`,
              SUM(CASE WHEN status='PENDING_COMMANDER_REVIEW' THEN 1 ELSE 0 END) AS \`pending_review\`,
              SUM(CASE WHEN status='CONFIRMED_BY_COMMANDER' THEN 1 ELSE 0 END) AS \`confirmed\`,
              SUM(CASE WHEN status='CLOSED' THEN 1 ELSE 0 END) AS \`closed\`
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

module.exports = { getCases, getCaseById, createCase, updateCase, getCaseStats };
