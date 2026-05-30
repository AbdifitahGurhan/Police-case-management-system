// src/controllers/reportController.js — Reports and audit logs
'use strict';

const db = require('../config/database');

const buildDateWhere = (alias, query, params) => {
  let where = '1=1';
  const prefix = alias ? `${alias}.` : '';
  if (query.from_date) { where += ` AND DATE(${prefix}created_at) >= ?`; params.push(query.from_date); }
  if (query.to_date) { where += ` AND DATE(${prefix}created_at) <= ?`; params.push(query.to_date); }
  return where;
};

const applyCaseScope = (user, where, params, alias = '') => {
  const prefix = alias ? `${alias}.` : '';
  if (user.scopeType === 'state_administration') { where += ` AND ${prefix}state_administration_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'region') { where += ` AND ${prefix}region_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'city') { where += ` AND ${prefix}city_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'district') { where += ` AND ${prefix}district_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'neighborhood') { where += ` AND ${prefix}neighborhood_id = ?`; params.push(user.scopeId); }
  return where;
};

const applyArrestCaseScope = (user, where, params, caseAlias = 'c') => {
  if (user.scopeType === 'state_administration') { where += ` AND ${caseAlias}.state_administration_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'region') { where += ` AND ${caseAlias}.region_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'city') { where += ` AND ${caseAlias}.city_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'district') { where += ` AND ${caseAlias}.district_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'neighborhood') { where += ` AND ${caseAlias}.neighborhood_id = ?`; params.push(user.scopeId); }
  return where;
};

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
    if (station_id) { dateWhere += ' AND district_id = ?'; params.push(station_id); }
    dateWhere = applyCaseScope(req.user, dateWhere, params);

    const [[caseStats]] = await db.query(
      `SELECT COUNT(*) AS \`total_cases\`,
              SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS \`draft\`,
              SUM(CASE WHEN status='pending_commander_review' THEN 1 ELSE 0 END) AS \`pending_review\`,
              SUM(CASE WHEN status IN ('confirmed_by_ward_commander', 'under_investigation', 'referred_cid', 'transferred', 'reassigned') THEN 1 ELSE 0 END) AS \`confirmed_active\`,
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
    const [[stationsStats]] = await db.query('SELECT COUNT(*) AS total_stations FROM districts');

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

const getRegionDashboardStats = async (req, res, next) => {
  try {
    if (req.user.role !== 'admin' && req.user.scopeType !== 'region') {
      return res.status(403).json({ success: false, message: 'Region dashboard is available only for regional scope users.' });
    }

    const regionId = req.user.role === 'admin' ? Number(req.query.region_id || 0) : Number(req.user.scopeId);
    if (!regionId) {
      return res.status(400).json({ success: false, message: 'region_id is required for admin region dashboard view.' });
    }

    const params = [regionId];
    const [[region]] = await db.query(
      `SELECT r.id, r.region_name, r.region_code, sa.state_name,
              po.full_name AS commander_name, po.phone AS commander_phone
       FROM regions r
       LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id
       LEFT JOIN police_officers po ON r.commander_officer_id = po.id
       WHERE r.id = ?`,
      params
    );
    if (!region) return res.status(404).json({ success: false, message: 'Region not found.' });

    const [[summary]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM cases WHERE region_id = ?) AS total_cases,
         (SELECT COUNT(*) FROM cases WHERE region_id = ? AND status NOT IN ('closed','CLOSED','dismissed','rejected','archived')) AS open_cases,
         (SELECT COUNT(*) FROM cases WHERE region_id = ? AND status IN ('closed','CLOSED')) AS closed_cases,
         (SELECT COUNT(*) FROM cases WHERE region_id = ? AND status IN ('pending_commander_review','pending','CASE_REGISTERED')) AS pending_cases,
         (SELECT COUNT(DISTINCT d.id) FROM districts d JOIN cities ci ON d.city_id = ci.id WHERE ci.region_id = ?) AS district_police_stations,
         (SELECT COUNT(DISTINCT n.id) FROM neighborhoods n JOIN districts d ON n.district_id = d.id JOIN cities ci ON d.city_id = ci.id WHERE ci.region_id = ?) AS waax_police_stations,
         (SELECT COUNT(DISTINCT oa.officer_id)
            FROM officer_assignments oa
            LEFT JOIN districts d ON oa.assignment_type = 'District' AND oa.assignment_id = d.id
            LEFT JOIN cities dci ON d.city_id = dci.id
            LEFT JOIN neighborhoods n ON oa.assignment_type = 'Neighborhood' AND oa.assignment_id = n.id
            LEFT JOIN districts nd ON n.district_id = nd.id
            LEFT JOIN cities nci ON nd.city_id = nci.id
           WHERE oa.is_current = 1
             AND ((oa.assignment_type = 'Region' AND oa.assignment_id = ?)
               OR dci.region_id = ?
               OR nci.region_id = ?)) AS officers_registered,
         (SELECT COUNT(DISTINCT cs.suspect_id) FROM case_suspects cs JOIN cases c ON c.id = cs.case_id WHERE c.region_id = ?) AS suspects_registered,
         (SELECT COUNT(DISTINCT cv.victim_id) FROM case_victims cv JOIN cases c ON c.id = cv.case_id WHERE c.region_id = ?) AS victims_registered,
         (SELECT COUNT(DISTINCT s.id)
            FROM suspects s
            LEFT JOIN case_suspects cs ON cs.suspect_id = s.id
            LEFT JOIN cases c ON c.id = cs.case_id
            LEFT JOIN arrests a ON a.suspect_id = s.id
           WHERE c.region_id = ? AND (a.sentence_status = 'wanted' OR s.arrest_status = 'wanted')) AS wanted_persons,
         (SELECT COUNT(DISTINCT a.id) FROM arrests a JOIN cases c ON c.id = a.case_id WHERE c.region_id = ?) AS arrest_records,
         (SELECT COUNT(DISTINCT c.id)
            FROM cases c
            LEFT JOIN arrests a ON a.case_id = c.id
           WHERE c.region_id = ? AND (c.status IN ('released','closed','CLOSED') OR a.sentence_status = 'released')) AS released_cases,
         (SELECT COUNT(DISTINCT u.id) FROM users u WHERE u.region_id = ? AND u.is_active = 1) AS active_users`,
      Array(15).fill(regionId)
    );

    const [caseStatus] = await db.query(
      `SELECT
         CASE
           WHEN status IN ('closed','CLOSED') THEN 'Closed'
           WHEN status IN ('pending_commander_review','pending','CASE_REGISTERED') THEN 'Pending'
           ELSE 'Open'
         END AS status_group,
         COUNT(*) AS total
       FROM cases
       WHERE region_id = ?
       GROUP BY status_group
       ORDER BY total DESC`,
      params
    );

    const [monthlyTrends] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS total_cases
       FROM cases
       WHERE region_id = ?
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month ASC
       LIMIT 12`,
      params
    );

    const [stationPerformance] = await db.query(
      `SELECT d.id, d.district_name AS station_name, d.district_code AS station_code,
              COUNT(DISTINCT c.id) AS cases_count,
              SUM(CASE WHEN c.status IN ('closed','CLOSED') THEN 1 ELSE 0 END) AS closed_cases,
              COUNT(DISTINCT oa.officer_id) AS officers_count,
              MAX(c.created_at) AS last_activity
       FROM districts d
       JOIN cities ci ON d.city_id = ci.id
       LEFT JOIN cases c ON c.district_id = d.id
       LEFT JOIN officer_assignments oa ON oa.assignment_type = 'District' AND oa.assignment_id = d.id AND oa.is_current = 1
       WHERE ci.region_id = ?
       GROUP BY d.id
       ORDER BY cases_count DESC, d.district_name ASC`,
      params
    );

    const [waaxPerformance] = await db.query(
      `SELECT n.id, n.neighborhood_name AS waax_name, n.neighborhood_code AS waax_code,
              d.district_name AS district_name,
              COUNT(DISTINCT c.id) AS cases_count,
              COUNT(DISTINCT oa.officer_id) AS officers_count,
              MAX(c.created_at) AS last_activity
       FROM neighborhoods n
       JOIN districts d ON n.district_id = d.id
       JOIN cities ci ON d.city_id = ci.id
       LEFT JOIN cases c ON c.neighborhood_id = n.id
       LEFT JOIN officer_assignments oa ON oa.assignment_type = 'Neighborhood' AND oa.assignment_id = n.id AND oa.is_current = 1
       WHERE ci.region_id = ?
       GROUP BY n.id
       ORDER BY cases_count DESC, n.neighborhood_name ASC`,
      params
    );

    const [crimeCategories] = await db.query(
      `SELECT COALESCE(case_type, incident_type, 'Unknown') AS category, COUNT(*) AS total
       FROM cases
       WHERE region_id = ?
       GROUP BY COALESCE(case_type, incident_type, 'Unknown')
       ORDER BY total DESC
       LIMIT 10`,
      params
    );

    const [[arrestReleaseStats]] = await db.query(
      `SELECT COUNT(DISTINCT a.id) AS arrests,
              SUM(CASE WHEN a.sentence_status = 'released' THEN 1 ELSE 0 END) AS releases,
              SUM(CASE WHEN a.sentence_status = 'wanted' THEN 1 ELSE 0 END) AS wanted
       FROM arrests a
       JOIN cases c ON c.id = a.case_id
       WHERE c.region_id = ?`,
      params
    );

    const [recentCases] = await db.query(
      `SELECT c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
              c.status, c.priority, c.created_at, d.district_name, n.neighborhood_name AS waax_name
       FROM cases c
       LEFT JOIN districts d ON c.district_id = d.id
       LEFT JOIN neighborhoods n ON c.neighborhood_id = n.id
       WHERE c.region_id = ?
       ORDER BY c.created_at DESC
       LIMIT 8`,
      params
    );

    const [recentActivities] = await db.query(
      `SELECT ca.id, ca.case_id, ca.action_type, ca.description, ca.performed_by, ca.created_at,
              c.ob_number, COALESCE(c.title, c.case_title) AS case_title
       FROM case_actions ca
       JOIN cases c ON c.id = ca.case_id
       WHERE c.region_id = ?
       ORDER BY ca.created_at DESC
       LIMIT 8`,
      params
    );

    const [userActivity] = await db.query(
      `SELECT u.id, u.full_name, u.username, u.user_type, r.name AS role, u.last_login, u.status
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.region_id = ?
       ORDER BY COALESCE(u.last_login, u.created_at) DESC
       LIMIT 10`,
      params
    );

    res.json({
      success: true,
      data: {
        region,
        summary,
        caseStatus,
        monthlyTrends,
        stationPerformance,
        waaxPerformance,
        crimeCategories,
        arrestReleaseStats,
        recentCases,
        recentActivities,
        userActivity,
      },
    });
  } catch (err) { next(err); }
};

/** GET /api/reports/cases-by-station */
const getCasesByStation = async (req, res, next) => {
  try {
    const params = [];
    let stationWhere = '1=1';
    if (req.user.scopeType === 'state_administration') { stationWhere += ' AND r.state_administration_id = ?'; params.push(req.user.scopeId); }
    if (req.user.scopeType === 'region') { stationWhere += ' AND r.id = ?'; params.push(req.user.scopeId); }
    if (req.user.scopeType === 'city') { stationWhere += ' AND city.id = ?'; params.push(req.user.scopeId); }
    if (req.user.scopeType === 'district') { stationWhere += ' AND d.id = ?'; params.push(req.user.scopeId); }
    if (req.user.scopeType === 'neighborhood') { stationWhere += ' AND c.neighborhood_id = ?'; params.push(req.user.scopeId); }

    const [rows] = await db.query(
      `SELECT d.district_name AS \`station_name\`, d.district_code AS \`code\`, COUNT(c.id) AS \`total_cases\`,
              SUM(CASE WHEN c.status='pending_commander_review' THEN 1 ELSE 0 END) AS \`pending_cases\`, 
              SUM(CASE WHEN c.status='confirmed_by_ward_commander' THEN 1 ELSE 0 END) AS \`confirmed_cases\`,
              SUM(CASE WHEN c.status='closed' THEN 1 ELSE 0 END) AS \`closed_cases\`
       FROM districts d LEFT JOIN cases c ON d.id = c.district_id
       LEFT JOIN cities city ON d.city_id = city.id
       LEFT JOIN regions r ON city.region_id = r.id
       WHERE ${stationWhere}
       GROUP BY d.id ORDER BY \`total_cases\` DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getOffenderProfileReport = async (req, res, next) => {
  try {
    const { offender_id } = req.query;
    if (!offender_id) {
      return res.status(400).json({ success: false, message: 'offender_id is required.' });
    }

    const [[offender]] = await db.query(`
      SELECT s.*, COUNT(DISTINCT cs.case_id) AS case_count
      FROM suspects s
      LEFT JOIN case_suspects cs ON s.id = cs.suspect_id
      WHERE s.id = ?
      GROUP BY s.id
    `, [offender_id]);
    if (!offender) return res.status(404).json({ success: false, message: 'Offender not found.' });

    const [cases] = await db.query(`
      SELECT c.id, c.ob_number, COALESCE(c.title, c.case_title) AS title, c.case_type, c.status, c.priority,
             c.incident_date, c.incident_location, cs.role_in_case
      FROM case_suspects cs
      JOIN cases c ON c.id = cs.case_id
      WHERE cs.suspect_id = ?
      ORDER BY c.created_at DESC
    `, [offender_id]);

    res.json({ success: true, data: { offender, cases } });
  } catch (err) { next(err); }
};

const getStationFullReport = async (req, res, next) => {
  try {
    const stationId = Number(req.query.station_id || (req.user.scopeType === 'district' ? req.user.scopeId : 0));
    if (!stationId) {
      return res.status(400).json({ success: false, message: 'station_id is required.' });
    }

    const params = [stationId];
    let stationScope = 'd.id = ?';
    if (req.user.scopeType === 'state_administration') { stationScope += ' AND r.state_administration_id = ?'; params.push(req.user.scopeId); }
    if (req.user.scopeType === 'region') { stationScope += ' AND r.id = ?'; params.push(req.user.scopeId); }
    if (req.user.scopeType === 'city') { stationScope += ' AND ci.id = ?'; params.push(req.user.scopeId); }
    if (req.user.scopeType === 'district') { stationScope += ' AND d.id = ?'; params.push(req.user.scopeId); }
    if (req.user.scopeType === 'neighborhood') { stationScope += ' AND n.id = ?'; params.push(req.user.scopeId); }

    const [[station]] = await db.query(
      `SELECT d.id, d.district_name AS station_name, d.district_code AS station_code,
              ci.city_name, r.region_name, sa.state_name,
              po.full_name AS commander_name, po.phone AS commander_phone
       FROM districts d
       LEFT JOIN cities ci ON d.city_id = ci.id
       LEFT JOIN regions r ON ci.region_id = r.id
       LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id
       LEFT JOIN police_officers po ON d.commander_officer_id = po.id
       LEFT JOIN neighborhoods n ON n.district_id = d.id
       WHERE ${stationScope}
       GROUP BY d.id`,
      params
    );
    if (!station) return res.status(404).json({ success: false, message: 'Station not found or outside your access scope.' });

    const [[summary]] = await db.query(
      `SELECT
         COUNT(DISTINCT c.id) AS total_cases,
         COUNT(DISTINCT CASE WHEN c.status NOT IN ('closed','CLOSED','dismissed','rejected','archived') THEN c.id END) AS open_cases,
         COUNT(DISTINCT CASE WHEN c.status IN ('closed','CLOSED') THEN c.id END) AS closed_cases,
         COUNT(DISTINCT CASE WHEN c.status IN ('pending_commander_review','pending','CASE_REGISTERED') THEN c.id END) AS pending_cases,
         COUNT(DISTINCT n.id) AS total_waax,
         COUNT(DISTINCT cs.suspect_id) AS total_suspects,
         COUNT(DISTINCT cv.victim_id) AS total_victims,
         COUNT(DISTINCT a.id) AS total_arrests,
         COUNT(DISTINCT oa.officer_id) AS total_officers
       FROM districts d
       LEFT JOIN neighborhoods n ON n.district_id = d.id
       LEFT JOIN cases c ON c.district_id = d.id
       LEFT JOIN case_suspects cs ON cs.case_id = c.id
       LEFT JOIN case_victims cv ON cv.case_id = c.id
       LEFT JOIN arrests a ON a.case_id = c.id
       LEFT JOIN officer_assignments oa ON oa.assignment_type = 'District' AND oa.assignment_id = d.id AND oa.is_current = 1
       WHERE d.id = ?`,
      [stationId]
    );

    const [waaxUnits] = await db.query(
      `SELECT n.id, n.neighborhood_name AS waax_name, n.neighborhood_code AS waax_code,
              COUNT(DISTINCT c.id) AS total_cases,
              COUNT(DISTINCT cs.suspect_id) AS total_suspects
       FROM neighborhoods n
       LEFT JOIN cases c ON c.neighborhood_id = n.id
       LEFT JOIN case_suspects cs ON cs.case_id = c.id
       WHERE n.district_id = ?
       GROUP BY n.id
       ORDER BY n.neighborhood_name ASC`,
      [stationId]
    );

    const [cases] = await db.query(
      `SELECT c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
              c.case_type, c.incident_type, c.status, c.priority, c.incident_date,
              c.incident_location, c.original_ob_staff_name, n.neighborhood_name AS waax_name
       FROM cases c
       LEFT JOIN neighborhoods n ON c.neighborhood_id = n.id
       WHERE c.district_id = ?
       ORDER BY c.created_at DESC
       LIMIT 100`,
      [stationId]
    );

    const [suspects] = await db.query(
      `SELECT s.id, s.full_name, s.alias, s.gender, s.age, s.phone, s.arrest_status,
              COUNT(DISTINCT cs.case_id) AS case_count,
              GROUP_CONCAT(DISTINCT c.ob_number ORDER BY c.created_at DESC SEPARATOR ', ') AS ob_numbers
       FROM suspects s
       JOIN case_suspects cs ON cs.suspect_id = s.id
       JOIN cases c ON c.id = cs.case_id
       WHERE c.district_id = ?
       GROUP BY s.id
       ORDER BY s.full_name ASC`,
      [stationId]
    );

    const [victims] = await db.query(
      `SELECT v.id, v.full_name, v.gender, v.age, v.phone,
              GROUP_CONCAT(DISTINCT c.ob_number ORDER BY c.created_at DESC SEPARATOR ', ') AS ob_numbers
       FROM victims v
       JOIN case_victims cv ON cv.victim_id = v.id
       JOIN cases c ON c.id = cv.case_id
       WHERE c.district_id = ?
       GROUP BY v.id
       ORDER BY v.full_name ASC`,
      [stationId]
    );

    const [arrests] = await db.query(
      `SELECT a.id, s.full_name AS suspect_name, c.ob_number, COALESCE(c.title, c.case_title) AS case_title,
              a.arrest_date, a.arrest_location, a.charges, a.sentence_status, a.bail_status
       FROM arrests a
       JOIN cases c ON c.id = a.case_id
       JOIN suspects s ON s.id = a.suspect_id
       WHERE c.district_id = ?
       ORDER BY a.arrest_date DESC
       LIMIT 100`,
      [stationId]
    );

    const [activities] = await db.query(
      `SELECT ca.action_type, ca.description, ca.performed_by, ca.created_at, c.ob_number
       FROM case_actions ca
       JOIN cases c ON c.id = ca.case_id
       WHERE c.district_id = ?
       ORDER BY ca.created_at DESC
       LIMIT 50`,
      [stationId]
    );

    res.json({
      success: true,
      data: { station, summary, waaxUnits, cases, suspects, victims, arrests, activities },
    });
  } catch (err) { next(err); }
};

const getMonthlyCrimeReport = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;
    const params = [year];
    let where = 'YEAR(c.created_at) = ?';
    where = applyCaseScope(req.user, where, params, 'c');
    const [rows] = await db.query(`
      SELECT
        MONTH(c.created_at) AS month,
        COUNT(*) AS total_cases,
        SUM(CASE WHEN c.priority IN ('high', 'critical') THEN 1 ELSE 0 END) AS high_risk_cases,
        SUM(CASE WHEN c.status = 'closed' THEN 1 ELSE 0 END) AS closed_cases
      FROM cases c
      WHERE ${where}
      GROUP BY MONTH(c.created_at)
      ORDER BY month ASC
    `, params);
    res.json({ success: true, data: rows, meta: { year: Number(year) } });
  } catch (err) { next(err); }
};

const getRepeatOffenderReport = async (req, res, next) => {
  try {
    const params = [];
    let where = '1=1';
    where = applyCaseScope(req.user, where, params, 'c');
    const [rows] = await db.query(`
      SELECT s.id, s.full_name, s.alias, s.gender, s.age, s.nationality, s.phone, s.is_arrested,
             COUNT(DISTINCT cs.case_id) AS case_count,
             COUNT(DISTINCT a.id) AS arrest_count,
             MAX(c.created_at) AS last_case_date
      FROM suspects s
      JOIN case_suspects cs ON cs.suspect_id = s.id
      JOIN cases c ON c.id = cs.case_id
      LEFT JOIN arrests a ON a.suspect_id = s.id
      WHERE ${where}
      GROUP BY s.id
      HAVING COUNT(DISTINCT cs.case_id) > 1 OR COUNT(DISTINCT a.id) > 1
      ORDER BY GREATEST(COUNT(DISTINCT cs.case_id), COUNT(DISTINCT a.id)) DESC, last_case_date DESC
    `, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getStationPerformanceReport = async (req, res, next) => {
  try {
    return getCasesByStation(req, res, next);
  } catch (err) { next(err); }
};

const getCrimeCategoryReport = async (req, res, next) => {
  try {
    const params = [];
    let dateWhere = buildDateWhere('c', req.query, params);
    dateWhere = applyCaseScope(req.user, dateWhere, params, 'c');
    const [rows] = await db.query(`
      SELECT COALESCE(c.case_type, 'Unknown') AS case_type,
             COUNT(*) AS total_cases,
             SUM(CASE WHEN c.priority = 'critical' THEN 1 ELSE 0 END) AS critical_cases,
             SUM(CASE WHEN c.status = 'closed' THEN 1 ELSE 0 END) AS closed_cases,
             COUNT(DISTINCT cs.suspect_id) AS linked_offenders
      FROM cases c
      LEFT JOIN case_suspects cs ON cs.case_id = c.id
      WHERE ${dateWhere}
      GROUP BY COALESCE(c.case_type, 'Unknown')
      ORDER BY total_cases DESC
    `, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getCustodyDashboardReport = async (req, res, next) => {
  try {
    const params = [];
    let where = '1=1';
    where = applyArrestCaseScope(req.user, where, params, 'c');
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS total_arrests,
        SUM(CASE WHEN sentence_status IN ('sentenced','serving','release_review') THEN 1 ELSE 0 END) AS active_sentences,
        SUM(CASE WHEN expected_release_date <= CURDATE() AND sentence_status IN ('sentenced','serving','release_review') THEN 1 ELSE 0 END) AS due_for_release,
        SUM(CASE WHEN sentence_status = 'escaped' THEN 1 ELSE 0 END) AS escaped,
        SUM(CASE WHEN sentence_status = 'wanted' THEN 1 ELSE 0 END) AS wanted,
        SUM(CASE WHEN sentence_status = 'released' THEN 1 ELSE 0 END) AS released
      FROM arrests a
      JOIN cases c ON c.id = a.case_id
      WHERE ${where}
    `, params);
    const [[custodyStats]] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM biometric_identifiers) AS biometric_records,
        (SELECT COUNT(*) FROM prisoner_documents) AS documents,
        (SELECT COUNT(*) FROM prison_transfers) AS prison_transfers,
        (SELECT COUNT(*) FROM prisoner_medical_records) AS medical_records,
        (SELECT COUNT(*) FROM prisoner_visitor_logs) AS visitor_logs,
        (SELECT COUNT(*) FROM release_approvals WHERE status = 'pending') AS pending_release_approvals
    `);
    const [dueForRelease] = await db.query(`
      SELECT a.id AS arrest_id, s.id AS suspect_id, s.full_name, c.ob_number,
             a.expected_release_date, a.sentence_status
      FROM arrests a
      JOIN suspects s ON s.id = a.suspect_id
      JOIN cases c ON c.id = a.case_id
      WHERE ${where}
        AND a.expected_release_date <= CURDATE()
        AND a.sentence_status IN ('sentenced','serving','release_review')
      ORDER BY a.expected_release_date ASC
      LIMIT 20
    `, params);
    const [wantedEscaped] = await db.query(`
      SELECT a.id AS arrest_id, s.id AS suspect_id, s.full_name, c.ob_number,
             a.sentence_status, a.final_status
      FROM arrests a
      JOIN suspects s ON s.id = a.suspect_id
      JOIN cases c ON c.id = a.case_id
      WHERE ${where}
        AND a.sentence_status IN ('wanted','escaped')
      ORDER BY a.arrest_date DESC
      LIMIT 20
    `, params);

    res.json({ success: true, data: { stats: { ...stats, ...custodyStats }, dueForRelease, wantedEscaped } });
  } catch (err) { next(err); }
};

const getCustodyAnalyticsReport = async (req, res, next) => {
  try {
    const { year = new Date().getFullYear() } = req.query;

    const monthlyParams = [year];
    let monthlyWhere = 'YEAR(a.arrest_date) = ?';
    monthlyWhere = applyArrestCaseScope(req.user, monthlyWhere, monthlyParams, 'c');
    const [monthlyArrests] = await db.query(`
      SELECT MONTH(a.arrest_date) AS month,
             COUNT(*) AS arrested_people
      FROM arrests a
      JOIN cases c ON c.id = a.case_id
      WHERE ${monthlyWhere}
      GROUP BY MONTH(a.arrest_date)
      ORDER BY month ASC
    `, monthlyParams);

    const scopedParams = [];
    let scopedWhere = '1=1';
    scopedWhere = applyArrestCaseScope(req.user, scopedWhere, scopedParams, 'c');
    const [[statusSummary]] = await db.query(`
      SELECT
        SUM(CASE WHEN a.sentence_status = 'wanted' THEN 1 ELSE 0 END) AS wanted_persons,
        SUM(CASE WHEN a.sentence_status = 'released' THEN 1 ELSE 0 END) AS released_prisoners,
        SUM(CASE WHEN a.sentence_status = 'completed' OR (a.expected_release_date <= CURDATE() AND a.sentence_status IN ('sentenced','serving','release_review')) THEN 1 ELSE 0 END) AS sentence_completed,
        SUM(CASE WHEN a.sentence_status IN ('sentenced','serving','release_review') AND (a.expected_release_date IS NULL OR a.expected_release_date > CURDATE()) THEN 1 ELSE 0 END) AS still_serving,
        SUM(CASE WHEN a.sentence_status = 'escaped' THEN 1 ELSE 0 END) AS escaped_prisoners,
        COUNT(*) AS total_arrests
      FROM arrests a
      JOIN cases c ON c.id = a.case_id
      WHERE ${scopedWhere}
    `, scopedParams);

    const listQuery = (extraWhere, limit = 50) => db.query(`
      SELECT a.id AS arrest_id,
             s.id AS suspect_id,
             s.full_name,
             s.alias,
             c.ob_number,
             COALESCE(c.title, c.case_title) AS case_title,
             d.district_name AS station_name,
             a.arrest_date,
             a.charges,
             a.court_decision,
             a.sentence_status,
             a.sentence_start_date,
             a.expected_release_date,
             a.actual_release_date,
             a.final_status
      FROM arrests a
      JOIN suspects s ON s.id = a.suspect_id
      JOIN cases c ON c.id = a.case_id
      LEFT JOIN districts d ON d.id = c.district_id
      WHERE ${scopedWhere} AND ${extraWhere}
      ORDER BY a.arrest_date DESC
      LIMIT ${limit}
    `, scopedParams);

    const [wantedPersons] = await listQuery("a.sentence_status = 'wanted'");
    const [releasedPrisoners] = await listQuery("a.sentence_status = 'released'");
    const [sentenceCompleted] = await listQuery("(a.sentence_status = 'completed' OR (a.expected_release_date <= CURDATE() AND a.sentence_status IN ('sentenced','serving','release_review')))");
    const [stillServing] = await listQuery("a.sentence_status IN ('sentenced','serving','release_review') AND (a.expected_release_date IS NULL OR a.expected_release_date > CURDATE())");

    res.json({
      success: true,
      data: {
        meta: { year: Number(year) },
        monthlyArrests,
        statusSummary,
        wantedPersons,
        releasedPrisoners,
        sentenceCompleted,
        stillServing,
      },
    });
  } catch (err) { next(err); }
};

/** GET /api/reports/arrests */
const getArrestsReport = async (req, res, next) => {
  try {
    const { from_date, to_date, region_id, station_id, officer_id, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';

    if (from_date) { where += ' AND DATE(a.arrest_date) >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND DATE(a.arrest_date) <= ?'; params.push(to_date); }
    if (region_id) { where += ' AND c.region_id = ?'; params.push(region_id); }
    if (station_id) { where += ' AND c.district_id = ?'; params.push(station_id); }
    if (officer_id) { where += ' AND (a.arresting_officer_id = ? OR a.officer_id = ?)'; params.push(officer_id, officer_id); }

    where = applyArrestCaseScope(req.user, where, params, 'c');

    const [rows] = await db.query(
      `SELECT a.id, a.arrest_date, a.arrest_location, a.charges, a.sentence_status, a.bail_status,
              s.id AS suspect_id, s.full_name AS suspect_name,
              c.id AS case_id, c.ob_number, d.district_name AS station_name,
              po.full_name AS arresting_officer
       FROM arrests a
       JOIN suspects s ON s.id = a.suspect_id
       JOIN cases c ON c.id = a.case_id
       LEFT JOIN districts d ON d.id = c.district_id
       LEFT JOIN police_officers po ON po.id = a.arresting_officer_id
       WHERE ${where}
       ORDER BY a.arrest_date DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM arrests a JOIN cases c ON c.id = a.case_id WHERE ${where}`,
      params
    );

    res.json({ success: true, data: rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
};

/** GET /api/reports/evidence-inventory */
const getEvidenceInventoryReport = async (req, res, next) => {
  try {
    const { from_date, to_date, region_id, station_id, case_id, status, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];

    let where = '1=1';
    if (from_date) { where += ' AND DATE(e.created_at) >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND DATE(e.created_at) <= ?'; params.push(to_date); }
    if (case_id) { where += ' AND e.case_id = ?'; params.push(case_id); }
    if (status) { where += ' AND e.status = ?'; params.push(status); }
    if (region_id) { where += ' AND c.region_id = ?'; params.push(region_id); }
    if (station_id) { where += ' AND c.district_id = ?'; params.push(station_id); }

    // apply user's scope based on case
    if (!where.includes('c.')) {
      // ensure joins later still work; applyCaseScope will push params
    }
    where = applyCaseScope(req.user, where, params, 'c');

    const [rows] = await db.query(
      `SELECT e.id, e.evidence_tag, e.item_description, e.quantity, e.condition, e.status, e.storage_location, e.created_at,
              c.ob_number, d.district_name AS station_name
       FROM evidence e
       LEFT JOIN cases c ON c.id = e.case_id
       LEFT JOIN districts d ON d.id = c.district_id
       WHERE ${where}
       ORDER BY e.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM evidence e LEFT JOIN cases c ON c.id = e.case_id WHERE ${where}`, params);
    res.json({ success: true, data: rows, pagination: { page: parseInt(page), limit: parseInt(limit), total } });
  } catch (err) { next(err); }
};

/** GET /api/reports/officer-activity */
const getOfficerActivityReport = async (req, res, next) => {
  try {
    const { from_date, to_date, officer_id, region_id, station_id, page = 1, limit = 100 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = '1=1';

    if (from_date) { where += ' AND DATE(ca.created_at) >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND DATE(ca.created_at) <= ?'; params.push(to_date); }
    if (officer_id) { where += ' AND ca.performed_by = ?'; params.push(officer_id); }
    if (region_id) { where += ' AND c.region_id = ?'; params.push(region_id); }
    if (station_id) { where += ' AND c.district_id = ?'; params.push(station_id); }

    where = applyCaseScope(req.user, where, params, 'c');

    const [rows] = await db.query(
      `SELECT ca.id, ca.case_id, ca.action_type, ca.description, ca.performed_by, ca.created_at,
              c.ob_number, d.district_name AS station_name, po.full_name AS officer_name
       FROM case_actions ca
       JOIN cases c ON c.id = ca.case_id
       LEFT JOIN districts d ON d.id = c.district_id
       LEFT JOIN police_officers po ON po.id = ca.performed_by
       WHERE ${where}
       ORDER BY ca.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Summary counts
    const [[{ total_actions }]] = await db.query(`SELECT COUNT(*) AS total_actions FROM case_actions ca JOIN cases c ON c.id = ca.case_id WHERE ${where}`, params);
    const [[{ unique_cases }]] = await db.query(`SELECT COUNT(DISTINCT ca.case_id) AS unique_cases FROM case_actions ca JOIN cases c ON c.id = ca.case_id WHERE ${where}`, params);
    const [[{ arrests_made }]] = await db.query(`SELECT COUNT(*) AS arrests_made FROM arrests a JOIN cases c ON c.id = a.case_id WHERE ${where} AND a.arresting_officer_id = ?`, officer_id ? [...params, officer_id] : params);

    res.json({ success: true, data: { actions: rows, summary: { total_actions, unique_cases, arrests_made } }, pagination: { page: parseInt(page), limit: parseInt(limit), total: total_actions } });
  } catch (err) { next(err); }
};

module.exports = {
  getAuditLogs,
  getSummaryReport,
  getCasesByStation,
  getStationFullReport,
  getUnitDashboardStats,
  getRegionDashboardStats,
  getOffenderProfileReport,
  getMonthlyCrimeReport,
  getRepeatOffenderReport,
  getStationPerformanceReport,
  getCrimeCategoryReport,
  getCustodyDashboardReport,
  getCustodyAnalyticsReport,
  getArrestsReport,
  getEvidenceInventoryReport,
  getOfficerActivityReport,
};
