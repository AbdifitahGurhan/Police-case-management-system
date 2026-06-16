'use strict';

const db = require('../config/database');
const { buildScopeWhere, normalizeRole } = require('../utils/locationScope');

const CID_ROLES = ['cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'prosecutor_liaison'];

const actorNames = (user) => [...new Set([user?.username, user?.fullName, user?.full_name, user?.email].filter(Boolean))];

const getCidNotifications = async (req) => {
  const role = normalizeRole(req.user?.role);
  const params = [];
  let visibility = '1=1';
  if (role === 'cid_officer') {
    const names = actorNames(req.user);
    visibility = names.length ? `cid.assigned_officer IN (${names.map(() => '?').join(',')})` : '1=0';
    params.push(...names);
  }
  if (role === 'prosecutor_liaison') {
    visibility = "cid.investigation_status = 'approved'";
  }

  const [rows] = await db.query(
    `SELECT
        CONCAT('cid-case-', cid.id) AS id,
        CASE
          WHEN cid.investigation_status = 'supervisor_review' THEN 'CID_REPORT_SUBMITTED'
          WHEN cid.investigation_status = 'approved' THEN 'CID_READY_FOR_PROSECUTOR'
          ELSE 'NEW_CID_CASE_ASSIGNED'
        END AS type,
        CASE
          WHEN cid.investigation_status = 'supervisor_review' THEN 'CID report pending review'
          WHEN cid.investigation_status = 'approved' THEN 'CID case ready for prosecutor'
          ELSE 'New CID case assigned'
        END AS title,
        CONCAT(cid.case_number, ' - ', COALESCE(cid.case_title, 'CID investigation')) AS message,
        cid.id AS cid_case_id,
        cid.police_case_id AS case_id,
        cid.created_at,
        0 AS is_read
     FROM cid_cases cid
     WHERE ${visibility}
       AND (
         cid.assignment_status = 'assigned'
         OR cid.investigation_status IN ('supervisor_review','approved')
       )
     ORDER BY cid.updated_at DESC, cid.created_at DESC
     LIMIT 20`,
    params
  );

  return rows;
};

const getNotifications = async (req, res, next) => {
  try {
    const role = normalizeRole(req.user?.role);
    if (CID_ROLES.includes(role)) {
      const data = await getCidNotifications(req);
      return res.json({ success: true, data: data.slice(0, Number(req.query.limit || 20)), unread: data.filter((item) => !item.is_read).length });
    }

    const scope = buildScopeWhere(req.user, 'c');
    const params = [...scope.params];

    const [caseEvents] = await db.query(
      `SELECT
          CONCAT('case-action-', ca.id) AS id,
          ca.action_type AS type,
          COALESCE(c.case_number, c.ob_number, CONCAT('Case #', c.id)) AS title,
          ca.description AS message,
          c.id AS case_id,
          ca.created_at,
          0 AS is_read
       FROM case_actions ca
       JOIN cases c ON c.id = ca.case_id
       WHERE ${scope.clause}
       ORDER BY ca.created_at DESC
       LIMIT 15`,
      params
    );

    const [auditEvents] = await db.query(
      `SELECT
          CONCAT('audit-', id) AS id,
          action AS type,
          action AS title,
          CONCAT(COALESCE(entity_type, 'system'), ' updated by ', COALESCE(user_id, user_email, 'unknown')) AS message,
          entity_id AS case_id,
          created_at,
          0 AS is_read
       FROM audit_logs
       WHERE action IN ('CREATE_CASE', 'UPDATE_CASE', 'CREATE_EVIDENCE', 'CONVERT_OB_TO_CASE', 'CREATE_OB_ENTRY')
       ORDER BY created_at DESC
       LIMIT 10`
    );

    const data = [...caseEvents, ...auditEvents]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, Number(req.query.limit || 20));

    res.json({ success: true, data, unread: data.filter((item) => !item.is_read).length });
  } catch (err) {
    next(err);
  }
};

module.exports = { getNotifications };
