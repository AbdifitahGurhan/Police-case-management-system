// src/controllers/reportController.js — Reports and audit logs
'use strict';

const db = require('../config/database');

/** GET /api/reports/audit-logs */
const getAuditLogs = async (req, res, next) => {
  try {
    const { user_id, action, entity_type, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (user_id) { where += ' AND al.user_id = ?'; params.push(user_id); }
    if (action) { where += ' AND al.action LIKE ?'; params.push(`%${action}%`); }
    if (entity_type) { where += ' AND al.entity_type = ?'; params.push(entity_type); }
    if (from_date) { where += ' AND DATE(al.created_at) >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND DATE(al.created_at) <= ?'; params.push(to_date); }

    const [rows] = await db.query(
      `SELECT al.* FROM audit_logs al WHERE ${where} ORDER BY al.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM audit_logs al WHERE ${where}`, params);
    res.json({ success: true, data: rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
};

/** GET /api/reports/summary — Case summary stats */
const getSummaryReport = async (req, res, next) => {
  try {
    const { from_date, to_date, station_id } = req.query;
    let dateWhere = '1=1';
    const params = [];
    if (from_date) { dateWhere += ' AND DATE(created_at) >= ?'; params.push(from_date); }
    if (to_date) { dateWhere += ' AND DATE(created_at) <= ?'; params.push(to_date); }
    if (station_id) { dateWhere += ' AND station_id = ?'; params.push(station_id); }

    const [[caseStats]] = await db.query(
      `SELECT COUNT(*) AS \`total_cases\`,
              SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS \`draft\`,
              SUM(CASE WHEN status='pending_commander_review' THEN 1 ELSE 0 END) AS \`pending_review\`,
              SUM(CASE WHEN status IN ('confirmed_by_ward_commander', 'under_investigation', 'referred_cid', 'referred_prosecutor', 'transferred', 'reassigned', 'approved_for_court') THEN 1 ELSE 0 END) AS \`confirmed_active\`,
              SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS \`closed\`,
              SUM(CASE WHEN status='dismissed' THEN 1 ELSE 0 END) AS \`dismissed\`,
              SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) AS \`rejected\`,
              SUM(CASE WHEN priority='high' THEN 1 ELSE 0 END) AS \`high_priority\`,
              SUM(CASE WHEN priority='critical' THEN 1 ELSE 0 END) AS \`critical_priority\`
       FROM cases WHERE ${dateWhere}`, params
    );

    const [byType] = await db.query(
      `SELECT case_type, COUNT(*) AS count FROM cases WHERE ${dateWhere} AND case_type IS NOT NULL GROUP BY case_type ORDER BY count DESC`, params
    );

    const [[evidenceStats]] = await db.query('SELECT COUNT(*) AS total_evidence FROM evidence');
    const [[userStats]] = await db.query('SELECT COUNT(*) AS total_users FROM users WHERE is_active = 1');
    const [[stationsStats]] = await db.query('SELECT COUNT(*) AS total_stations FROM neighborhoods');

    res.json({
      success: true,
      data: { caseStats, byType, evidenceStats, userStats, stationsStats },
    });
  } catch (err) { next(err); }
};

/** GET /api/reports/unit-dashboard */
const getUnitDashboardStats = async (req, res, next) => {
  try {
    const { scopeType, scopeId } = req.user;
    if (!scopeType || !scopeId) {
      return res.status(403).json({ success: false, message: 'Invalid unit scope.' });
    }

    let stats = {
      subordinate_units: 0,
      officers_deployed: 0,
       cases_count: 0
    };

    let childrenQuery = '';
    let officerColumn = '';
    let caseColumn = '';

    if (scopeType === 'state_administration') {
      childrenQuery = 'SELECT COUNT(*) as c FROM regions WHERE state_administration_id = ?';
      officerColumn = 'state_administration_id';
      caseColumn = 'state_administration_id';
    } else if (scopeType === 'region') {
      childrenQuery = 'SELECT COUNT(*) as c FROM cities WHERE region_id = ?';
      officerColumn = 'region_id';
      caseColumn = 'region_id';
    } else if (scopeType === 'city') {
      childrenQuery = 'SELECT COUNT(*) as c FROM districts WHERE city_id = ?';
      officerColumn = 'city_id';
      caseColumn = 'city_id';
    } else if (scopeType === 'district') {
      childrenQuery = 'SELECT COUNT(*) as c FROM neighborhoods WHERE district_id = ?';
      officerColumn = 'district_id';
      caseColumn = 'district_id';
    } else if (scopeType === 'neighborhood') {
      childrenQuery = null; // No children
      officerColumn = 'neighborhood_id';
      caseColumn = 'neighborhood_id';
    }

    // Children count
    if (childrenQuery) {
      const [[raw]] = await db.query(childrenQuery, [scopeId]);
      stats.subordinate_units = raw.c;
    }

    // Officer Count (current assignment logic dictates we query officer_assignments? Given the user requested a strict structure, 
    // we should simply query `officer_assignments` active records pointing to this scope.)
    const [[officerRaw]] = await db.query(`
      SELECT COUNT(DISTINCT officer_id) as c 
      FROM officer_assignments 
      WHERE assignment_type = ? AND assignment_id = ? AND is_current = 1
    `, [scopeType.charAt(0).toUpperCase() + scopeType.slice(1).replace('_', ' '), scopeId]);
    stats.officers_deployed = officerRaw.c;

    // Case Count
    const [[caseRaw]] = await db.query(`
      SELECT COUNT(*) as c FROM cases WHERE ${caseColumn} = ?
    `, [scopeId]);
    stats.cases_count = caseRaw.c;

    // Commander Details
    const tableMap = {
      'state_administration': 'state_administrations',
      'region': 'regions',
      'city': 'cities',
      'district': 'districts',
      'neighborhood': 'neighborhoods'
    };
    const tableName = tableMap[scopeType];

    const [[commanderRaw]] = await db.query(`
      SELECT po.full_name, po.profile_image, r.rank_name
      FROM ${tableName} t
      LEFT JOIN police_officers po ON t.commander_officer_id = po.id
      LEFT JOIN ranks r ON po.rank_id = r.id
      WHERE t.id = ?
    `, [scopeId]);

    res.json({ success: true, data: { stats, commander: commanderRaw || null } });
  } catch (err) { next(err); }
};

/** GET /api/reports/cases-by-station */
const getCasesByStation = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT n.neighborhood_name AS \`station_name\`, n.neighborhood_code AS \`code\`, COUNT(c.id) AS \`total_cases\`,
              SUM(CASE WHEN c.status='pending_commander_review' THEN 1 ELSE 0 END) AS \`pending_cases\`, 
              SUM(CASE WHEN c.status='confirmed_by_ward_commander' THEN 1 ELSE 0 END) AS \`confirmed_cases\`,
              SUM(CASE WHEN c.status='closed' THEN 1 ELSE 0 END) AS \`closed_cases\`
       FROM neighborhoods n LEFT JOIN cases c ON n.id = c.neighborhood_id
       GROUP BY n.id ORDER BY \`total_cases\` DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { getAuditLogs, getSummaryReport, getCasesByStation, getUnitDashboardStats };
