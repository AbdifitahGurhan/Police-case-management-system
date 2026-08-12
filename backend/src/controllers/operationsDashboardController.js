'use strict';

const db = require('../config/database');
const { normalizeRole } = require('../utils/locationScope');

const TERMINAL_STATUSES = ['closed', 'CLOSED', 'court_decided', 'REJECTED', 'dismissed', 'rejected', 'archived'];
const COMMAND_ROLES = new Set([
  'admin',
  'state_admin',
  'state_commander',
  'region_admin',
  'region_commander',
  'district_admin',
  'district_commander',
  'police_station_commander',
]);
const DISTRICT_ACTION_ROLES = new Set(['district_admin', 'district_commander', 'police_station_commander']);

const firstDayOfMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const today = () => new Date().toISOString().slice(0, 10);

const asNumber = (value) => Number(value || 0);

const dateRange = (query) => ({
  from: query.from || firstDayOfMonth(),
  to: query.to || today(),
});

const userScope = (user) => {
  const role = normalizeRole(user?.role);
  if (role === 'admin') return { type: 'admin', id: null, label: 'Dhammaan States-ka' };
  if (user?.scopeType === 'state_administration') return { type: 'state', id: Number(user.scopeId), label: user.location?.stateName || user.fullName || 'State' };
  if (user?.scopeType === 'region') return { type: 'region', id: Number(user.scopeId), label: user.location?.regionName || user.fullName || 'Gobol' };
  if (user?.scopeType === 'district') return { type: 'district', id: Number(user.scopeId), label: user.location?.districtName || user.fullName || 'Degmo' };
  return { type: 'unknown', id: null, label: user?.fullName || 'Unknown' };
};

const scopeWhere = (scope, alias = 'c') => {
  if (scope.type === 'admin') return { clause: '1=1', params: [] };
  if (scope.type === 'state') return { clause: `${alias}.state_administration_id = ?`, params: [scope.id] };
  if (scope.type === 'region') return { clause: `${alias}.region_id = ?`, params: [scope.id] };
  if (scope.type === 'district') return { clause: `${alias}.district_id = ?`, params: [scope.id] };
  return { clause: '1=0', params: [] };
};

const dateWhere = (alias, column = 'created_at') => `${alias}.${column} >= ? AND ${alias}.${column} < DATE_ADD(?, INTERVAL 1 DAY)`;

const terminalList = () => TERMINAL_STATUSES.map(() => '?').join(',');
const terminalParams = (times = 1) => Array.from({ length: times }).flatMap(() => TERMINAL_STATUSES);
const hierarchyParams = (range) => [...terminalParams(2), ...rangeParams(range, 3)];

const safeScalar = async (sql, params, key) => {
  try {
    const [[row]] = await db.query(sql, params);
    return asNumber(row?.[key]);
  } catch (error) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) return 0;
    throw error;
  }
};

const safeRows = async (sql, params) => {
  try {
    const [rows] = await db.query(sql, params);
    return rows;
  } catch (error) {
    if (['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes(error.code)) return [];
    throw error;
  }
};

const districtFilter = (scope, alias = 'd', cityAlias = 'ci', regionAlias = 'r') => {
  if (scope.type === 'admin') return { clause: '1=1', params: [] };
  if (scope.type === 'state') return { clause: `${regionAlias}.state_administration_id = ?`, params: [scope.id] };
  if (scope.type === 'region') return { clause: `${cityAlias}.region_id = ?`, params: [scope.id] };
  if (scope.type === 'district') return { clause: `${alias}.id = ?`, params: [scope.id] };
  return { clause: '1=0', params: [] };
};

const getMetrics = async (scope, range) => {
  const caseScope = scopeWhere(scope, 'c');
  const obScope = scopeWhere(scope, 'ob');
  const complaintScope = districtFilter(scope, 'd', 'ci', 'r');
  const terminals = terminalList();

  const [[caseMetrics]] = await db.query(
    `SELECT COUNT(*) AS total_cases,
            SUM(c.status NOT IN (${terminals})) AS open_cases,
            SUM(c.status IN (${terminals})) AS closed_cases
       FROM cases c
      WHERE ${caseScope.clause} AND ${dateWhere('c')}`,
    [...TERMINAL_STATUSES, ...TERMINAL_STATUSES, ...caseScope.params, range.from, range.to]
  );

  const totalOb = await safeScalar(
    `SELECT COUNT(*) AS total FROM ob_entries ob WHERE ${obScope.clause} AND ${dateWhere('ob')}`,
    [...obScope.params, range.from, range.to],
    'total'
  );
  const totalOfficers = await safeScalar(
    `SELECT COUNT(DISTINCT oa.officer_id) AS total
       FROM officer_assignments oa
       LEFT JOIN districts d ON oa.assignment_type IN ('District','District Station') AND oa.assignment_id = d.id
       LEFT JOIN cities ci ON d.city_id = ci.id
       LEFT JOIN regions r ON ci.region_id = r.id
      WHERE oa.is_current = 1 AND ${complaintScope.clause}`,
    complaintScope.params,
    'total'
  );
  const arrests = await safeScalar(
    `SELECT COUNT(DISTINCT a.id) AS total FROM arrests a JOIN cases c ON c.id = a.case_id WHERE ${caseScope.clause} AND ${dateWhere('a', 'arrest_date')}`,
    [...caseScope.params, range.from, range.to],
    'total'
  );
  const prisoners = await safeScalar(
    `SELECT COUNT(DISTINCT pa.id) AS total
       FROM prison_admissions pa JOIN arrests a ON a.id = pa.arrest_id JOIN cases c ON c.id = a.case_id
      WHERE ${caseScope.clause} AND pa.status = 'admitted'`,
    caseScope.params,
    'total'
  );
  const investigatorTasks = await safeScalar(
    `SELECT COUNT(DISTINCT rf.id) AS total
       FROM referrals rf JOIN cases c ON c.id = rf.case_id
      WHERE ${caseScope.clause} AND LOWER(rf.referred_to_role) = 'investigator' AND ${dateWhere('rf', 'referred_at')}`,
    [...caseScope.params, range.from, range.to],
    'total'
  );
  const evidence = await safeScalar(
    `SELECT COUNT(DISTINCT e.id) AS total FROM evidence e JOIN cases c ON c.id = e.case_id WHERE ${caseScope.clause} AND ${dateWhere('e')}`,
    [...caseScope.params, range.from, range.to],
    'total'
  );
  const warrants = await safeScalar(
    `SELECT COUNT(DISTINCT w.id) AS total
       FROM warrants w
       LEFT JOIN cases c ON c.id = w.case_id
       LEFT JOIN ob_entries ob ON ob.id = w.ob_entry_id
      WHERE ${scope.type === 'admin' ? '1=1' : scope.type === 'state' ? 'COALESCE(c.state_administration_id, ob.state_administration_id) = ?' : scope.type === 'region' ? 'COALESCE(c.region_id, ob.region_id) = ?' : 'COALESCE(c.district_id, ob.district_id, w.police_station_id) = ?'}
        AND ${dateWhere('w')}`,
    scope.type === 'admin' ? [range.from, range.to] : [scope.id, range.from, range.to],
    'total'
  );
  const courtCases = await safeScalar(
    `SELECT COUNT(DISTINCT cc.id) AS total FROM court_cases cc JOIN cases c ON c.id = cc.police_case_id WHERE ${caseScope.clause} AND ${dateWhere('cc', 'registration_date')}`,
    [...caseScope.params, range.from, range.to],
    'total'
  );
  const complaints = await safeScalar(
    `SELECT COUNT(DISTINCT dc.id) AS total
       FROM district_complaints dc
       JOIN districts d ON d.id = dc.district_id
       JOIN cities ci ON ci.id = d.city_id
       JOIN regions r ON r.id = ci.region_id
      WHERE ${complaintScope.clause} AND ${dateWhere('dc')}`,
    [...complaintScope.params, range.from, range.to],
    'total'
  );

  return {
    total_ob: totalOb,
    total_cases: asNumber(caseMetrics.total_cases),
    open_cases: asNumber(caseMetrics.open_cases),
    closed_cases: asNumber(caseMetrics.closed_cases),
    total_officers: totalOfficers,
    arrests,
    prisoners,
    investigator_tasks: investigatorTasks,
    evidence,
    warrants,
    court_cases: courtCases,
    complaints,
  };
};

const getCaseStatus = async (scope, range) => {
  const caseScope = scopeWhere(scope, 'c');
  return safeRows(
    `SELECT CASE
              WHEN c.status IN (${terminalList()}) THEN 'Xiran'
              WHEN c.status IN ('pending_commander_review','pending','CASE_REGISTERED') THEN 'Sugaya'
              WHEN c.status IN ('under_investigation','confirmed_by_ward_commander','referred_cid','transferred','reassigned') THEN 'Baaris'
              ELSE 'Furan'
            END AS status,
            COUNT(*) AS total
       FROM cases c
      WHERE ${caseScope.clause} AND ${dateWhere('c')}
      GROUP BY status
      ORDER BY total DESC`,
    [...TERMINAL_STATUSES, ...caseScope.params, range.from, range.to]
  );
};

const getTrend = async (scope, range) => {
  const caseScope = scopeWhere(scope, 'c');
  return safeRows(
    `SELECT DATE(c.created_at) AS period, COUNT(*) AS total
       FROM cases c
      WHERE ${caseScope.clause} AND ${dateWhere('c')}
      GROUP BY DATE(c.created_at)
      ORDER BY period ASC`,
    [...caseScope.params, range.from, range.to]
  );
};

const getUrgentOperations = async (scope, range) => {
  const caseScope = scopeWhere(scope, 'c');
  return safeRows(
    `SELECT c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
            c.priority, c.status, c.created_at, sa.state_name, r.region_name, d.district_name
       FROM cases c
       LEFT JOIN state_administrations sa ON sa.id = c.state_administration_id
       LEFT JOIN regions r ON r.id = c.region_id
       LEFT JOIN districts d ON d.id = c.district_id
      WHERE ${caseScope.clause}
        AND ${dateWhere('c')}
        AND (c.priority IN ('high','critical') OR c.case_level IN ('urgent','critical')
          OR (c.status NOT IN (${terminalList()}) AND c.created_at < DATE_SUB(NOW(), INTERVAL 14 DAY)))
      ORDER BY FIELD(c.priority,'critical','high','medium','low'), c.created_at ASC
      LIMIT 10`,
    [...caseScope.params, range.from, range.to, ...TERMINAL_STATUSES]
  );
};

const getRecentOperations = async (scope, range) => {
  const caseScope = scopeWhere(scope, 'c');
  return safeRows(
    `SELECT ca.id, ca.case_id, ca.action_type, ca.description, ca.performed_by, ca.created_at,
            c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
            sa.state_name, r.region_name, d.district_name
       FROM case_actions ca
       JOIN cases c ON c.id = ca.case_id
       LEFT JOIN state_administrations sa ON sa.id = c.state_administration_id
       LEFT JOIN regions r ON r.id = c.region_id
       LEFT JOIN districts d ON d.id = c.district_id
      WHERE ${caseScope.clause} AND ${dateWhere('ca')}
      ORDER BY ca.created_at DESC
      LIMIT 12`,
    [...caseScope.params, range.from, range.to]
  );
};

const hierarchyMetricsSelect = (whereClause) => `
  COUNT(DISTINCT c.id) AS total_cases,
  COUNT(DISTINCT CASE WHEN c.status NOT IN (${terminalList()}) THEN c.id END) AS open_cases,
  COUNT(DISTINCT CASE WHEN c.status IN (${terminalList()}) THEN c.id END) AS closed_cases,
  COUNT(DISTINCT ob.id) AS total_ob,
  COUNT(DISTINCT a.id) AS arrests,
  COUNT(DISTINCT dc.id) AS complaints
`;

const getDistrictRows = async (scope, range, extraWhere = '1=1', extraParams = []) => {
  const filter = districtFilter(scope, 'd', 'ci', 'r');
  return safeRows(
    `SELECT d.id, r.id AS region_id, d.district_name AS name, d.district_code AS code,
            ${hierarchyMetricsSelect()}
       FROM districts d
       JOIN cities ci ON ci.id = d.city_id
       JOIN regions r ON r.id = ci.region_id
       LEFT JOIN cases c ON c.district_id = d.id AND ${dateWhere('c')}
       LEFT JOIN ob_entries ob ON ob.district_id = d.id AND ${dateWhere('ob')}
       LEFT JOIN arrests a ON a.case_id = c.id
       LEFT JOIN district_complaints dc ON dc.district_id = d.id AND ${dateWhere('dc')}
      WHERE ${filter.clause} AND ${extraWhere}
      GROUP BY d.id
      ORDER BY total_cases DESC, d.district_name ASC`,
    [...hierarchyParams(range), ...filter.params, ...extraParams]
  );
};

const rangeParams = (range, times = 1) => Array.from({ length: times }).flatMap(() => [range.from, range.to]);

const getHierarchy = async (scope, range) => {
  if (scope.type === 'district') return [];
  if (scope.type === 'region') {
    return getDistrictRows(scope, range);
  }
  if (scope.type === 'state') {
    const regions = await safeRows(
      `SELECT r.id, r.region_name AS name, r.region_code AS code,
              ${hierarchyMetricsSelect()}
         FROM regions r
         LEFT JOIN cities ci ON ci.region_id = r.id
         LEFT JOIN districts d ON d.city_id = ci.id
         LEFT JOIN cases c ON c.region_id = r.id AND ${dateWhere('c')}
         LEFT JOIN ob_entries ob ON ob.region_id = r.id AND ${dateWhere('ob')}
         LEFT JOIN arrests a ON a.case_id = c.id
         LEFT JOIN district_complaints dc ON dc.district_id = d.id AND ${dateWhere('dc')}
        WHERE r.state_administration_id = ?
        GROUP BY r.id
        ORDER BY total_cases DESC, r.region_name ASC`,
      [...hierarchyParams(range), scope.id]
    );
    const districts = await getDistrictRows(scope, range);
    return regions.map((region) => ({
      ...region,
      children: districts.filter((district) => Number(district.region_id) === Number(region.id)),
    }));
  }

  const states = await safeRows(
    `SELECT sa.id, sa.state_name AS name, sa.state_code AS code,
            ${hierarchyMetricsSelect()}
       FROM state_administrations sa
       LEFT JOIN regions r ON r.state_administration_id = sa.id
       LEFT JOIN cities ci ON ci.region_id = r.id
       LEFT JOIN districts d ON d.city_id = ci.id
       LEFT JOIN cases c ON c.state_administration_id = sa.id AND ${dateWhere('c')}
       LEFT JOIN ob_entries ob ON ob.state_administration_id = sa.id AND ${dateWhere('ob')}
       LEFT JOIN arrests a ON a.case_id = c.id
       LEFT JOIN district_complaints dc ON dc.district_id = d.id AND ${dateWhere('dc')}
      GROUP BY sa.id
      ORDER BY total_cases DESC, sa.state_name ASC`,
    hierarchyParams(range)
  );
  const regions = await safeRows(
    `SELECT r.id, r.state_administration_id, r.region_name AS name, r.region_code AS code,
            ${hierarchyMetricsSelect()}
       FROM regions r
       LEFT JOIN cities ci ON ci.region_id = r.id
       LEFT JOIN districts d ON d.city_id = ci.id
       LEFT JOIN cases c ON c.region_id = r.id AND ${dateWhere('c')}
       LEFT JOIN ob_entries ob ON ob.region_id = r.id AND ${dateWhere('ob')}
       LEFT JOIN arrests a ON a.case_id = c.id
       LEFT JOIN district_complaints dc ON dc.district_id = d.id AND ${dateWhere('dc')}
      GROUP BY r.id
      ORDER BY total_cases DESC, r.region_name ASC`,
    hierarchyParams(range)
  );
  const districts = await safeRows(
    `SELECT d.id, r.id AS region_id, d.district_name AS name, d.district_code AS code,
            ${hierarchyMetricsSelect()}
       FROM districts d
       JOIN cities ci ON ci.id = d.city_id
       JOIN regions r ON r.id = ci.region_id
       LEFT JOIN cases c ON c.district_id = d.id AND ${dateWhere('c')}
       LEFT JOIN ob_entries ob ON ob.district_id = d.id AND ${dateWhere('ob')}
       LEFT JOIN arrests a ON a.case_id = c.id
       LEFT JOIN district_complaints dc ON dc.district_id = d.id AND ${dateWhere('dc')}
      GROUP BY d.id
      ORDER BY total_cases DESC, d.district_name ASC`,
    hierarchyParams(range)
  );

  return states.map((state) => ({
    ...state,
    children: regions
      .filter((region) => Number(region.state_administration_id) === Number(state.id))
      .map((region) => ({
        ...region,
        children: districts.filter((district) => Number(district.region_id) === Number(region.id)),
      })),
  }));
};

const getDistrictOperationsSnapshot = async (scope, range) => {
  if (scope.type !== 'district') return {};
  const districtScope = scopeWhere(scope, 'c');
  const officersFilter = districtFilter(scope, 'd', 'ci', 'r');

  const activeCases = await safeRows(
    `SELECT c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
            c.priority, c.status, c.created_at, c.assigned_officer_id, po.full_name AS assigned_officer
       FROM cases c
       LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
      WHERE ${districtScope.clause} AND c.status NOT IN (${terminalList()})
      ORDER BY (c.assigned_officer_id IS NULL) DESC, c.created_at ASC
      LIMIT 100`,
    [...districtScope.params, ...TERMINAL_STATUSES]
  );
  const officers = await safeRows(
    `SELECT po.id, po.full_name, po.force_number, rk.rank_name,
            COUNT(DISTINCT c.id) AS total_cases,
            COUNT(DISTINCT CASE WHEN c.status NOT IN (${terminalList()}) THEN c.id END) AS open_cases,
            COUNT(DISTINCT CASE WHEN c.status IN (${terminalList()}) THEN c.id END) AS closed_cases
       FROM officer_assignments oa
       JOIN police_officers po ON po.id = oa.officer_id
       LEFT JOIN ranks rk ON rk.id = po.rank_id
       LEFT JOIN districts d ON oa.assignment_type IN ('District','District Station') AND oa.assignment_id = d.id
       LEFT JOIN cities ci ON ci.id = d.city_id
       LEFT JOIN regions r ON r.id = ci.region_id
       LEFT JOIN cases c ON c.assigned_officer_id = po.id
      WHERE oa.is_current = 1 AND ${officersFilter.clause}
      GROUP BY po.id
      ORDER BY open_cases DESC, po.full_name ASC`,
    [...TERMINAL_STATUSES, ...TERMINAL_STATUSES, ...officersFilter.params]
  );
  const complaints = await safeRows(
    `SELECT dc.*, po.full_name AS assigned_officer,
            (dc.response_deadline < NOW() AND dc.status NOT IN ('resolved','closed')) AS overdue
       FROM district_complaints dc
       LEFT JOIN police_officers po ON po.id = dc.assigned_officer_id
      WHERE dc.district_id = ? AND ${dateWhere('dc')}
      ORDER BY FIELD(dc.status,'new','escalated','assigned','in_progress','resolved','closed'), dc.created_at DESC
      LIMIT 100`,
    [scope.id, range.from, range.to]
  );

  return { activeCases, officers, complaints };
};

const getOperationsDashboard = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (!COMMAND_ROLES.has(role)) {
      return res.status(403).json({ success: false, message: 'Operations dashboard is not available for this role.' });
    }
    const scope = userScope(req.user);
    if (scope.type !== 'admin' && !scope.id) {
      return res.status(403).json({ success: false, message: 'Valid command scope is required.' });
    }
    const range = dateRange(req.query || {});
    const canAct = DISTRICT_ACTION_ROLES.has(role) && scope.type === 'district';

    const [metrics, caseStatus, trend, urgentOperations, recentOperations, hierarchy, districtOperations] = await Promise.all([
      getMetrics(scope, range),
      getCaseStatus(scope, range),
      getTrend(scope, range),
      getUrgentOperations(scope, range),
      getRecentOperations(scope, range),
      getHierarchy(scope, range),
      getDistrictOperationsSnapshot(scope, range),
    ]);

    res.json({
      success: true,
      data: {
        scope,
        dateRange: range,
        permissions: { canAct, canDrillDown: scope.type !== 'district' },
        metrics,
        caseStatus,
        trend,
        urgentOperations,
        recentOperations,
        hierarchy,
        districtOperations,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getOperationsDashboard };
