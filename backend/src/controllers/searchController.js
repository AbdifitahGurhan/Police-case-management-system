'use strict';

const db = require('../config/database');
const { buildScopeWhere } = require('../utils/locationScope');

const like = (value) => `%${String(value || '').trim()}%`;

const globalSearch = async (req, res, next) => {
  try {
    const { q, status, priority, station, from_date, to_date, limit = 50 } = req.query;
    const safeLimit = Math.min(Number(limit) || 50, 100);
    const term = String(q || '').trim();
    const results = [];

    const scope = buildScopeWhere(req.user, 'c');
    let caseWhere = scope.clause;
    const caseParams = [...scope.params];

    if (term) {
      caseWhere += ` AND (
        c.case_number LIKE ? OR c.ob_number LIKE ? OR COALESCE(c.title, c.case_title) LIKE ?
        OR c.incident_type LIKE ? OR c.incident_location LIKE ? OR c.complainant_name LIKE ?
        OR c.victim_name LIKE ? OR s.full_name LIKE ? OR s.phone LIKE ? OR s.id_number LIKE ?
      )`;
      caseParams.push(...Array(10).fill(like(term)));
    }
    if (status) { caseWhere += ' AND c.status = ?'; caseParams.push(status); }
    if (priority) { caseWhere += ' AND c.priority = ?'; caseParams.push(priority); }
    if (station) {
      caseWhere += ' AND (d.district_name LIKE ? OR n.neighborhood_name LIKE ?)';
      caseParams.push(like(station), like(station));
    }
    if (from_date) { caseWhere += ' AND DATE(c.created_at) >= ?'; caseParams.push(from_date); }
    if (to_date) { caseWhere += ' AND DATE(c.created_at) <= ?'; caseParams.push(to_date); }

    const [cases] = await db.query(
      `SELECT DISTINCT
          'case' AS result_type,
          c.id,
          c.case_number,
          c.ob_number,
          COALESCE(c.title, c.case_title) AS title,
          c.status,
          c.priority,
          c.incident_location,
          d.district_name AS station_name,
          c.created_at,
          CONCAT('/cases/', c.id) AS href
       FROM cases c
       LEFT JOIN case_suspects cs ON cs.case_id = c.id
       LEFT JOIN suspects s ON s.id = cs.suspect_id
       LEFT JOIN districts d ON d.id = c.district_id
       LEFT JOIN neighborhoods n ON n.id = c.neighborhood_id
       WHERE ${caseWhere}
       ORDER BY c.created_at DESC
       LIMIT ?`,
      [...caseParams, safeLimit]
    );
    results.push(...cases);

    if (term) {
      const [suspects] = await db.query(
        `SELECT
            'suspect' AS result_type,
            s.id,
            NULL AS case_number,
            NULL AS ob_number,
            s.full_name AS title,
            s.arrest_status AS status,
            NULL AS priority,
            s.address AS incident_location,
            NULL AS station_name,
            s.created_at,
            CONCAT('/offenders?id=', s.id) AS href
         FROM suspects s
         WHERE s.full_name LIKE ? OR s.phone LIKE ? OR s.id_number LIKE ? OR s.mother_name LIKE ?
         ORDER BY s.created_at DESC
         LIMIT ?`,
        [like(term), like(term), like(term), like(term), Math.min(safeLimit, 25)]
      );
      results.push(...suspects);
    }

    res.json({
      success: true,
      data: results
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, safeLimit),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { globalSearch };
