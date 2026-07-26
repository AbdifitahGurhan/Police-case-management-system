'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { ensureCourtCaseForPoliceCase } = require('../services/courtService');
const { syncCriminalCustodyStatus } = require('../utils/custodyStatus');
const {
  WorkflowError,
  withTransaction,
  validateSentence,
  validateJudgmentSentenceConsistency,
  closeCourtWorkflow,
} = require('../services/caseWorkflowService');

const actor = (req) => req.user?.username || String(req.user?.id || 'system');
const normalizedRole = (req) => String(req.user?.role || '').toLowerCase();
const actorNames = (req) => [...new Set([req.user?.username, req.user?.fullName, req.user?.full_name, req.user?.email].filter(Boolean))];

const addVisibilityFilter = (req, params, alias = 'cc') => {
  const role = normalizedRole(req);
  const names = actorNames(req);
  if (!names.length || ['admin', 'court', 'court_admin', 'court_clerk'].includes(role)) return '';
  if (role === 'judge') {
    params.push(...names);
    return ` AND ${alias}.assigned_judge IN (${names.map(() => '?').join(',')})`;
  }
  if (role === 'prosecutor') {
    params.push(...names);
    return ` AND (${alias}.assigned_prosecutor IN (${names.map(() => '?').join(',')}) OR ${alias}.assigned_prosecutor IS NULL)`;
  }
  return '';
};

const auditRequestMeta = (req) => ({
  ipAddress: req.ip,
  userAgent: req.get?.('user-agent') || null,
});

const friendlyStatus = {
  registered: 'New',
  awaiting_hearing: 'Awaiting Hearing',
  hearing_scheduled: 'Hearing Scheduled',
  in_trial: 'In Trial',
  judgment_issued: 'Judgment Issued',
  sentenced: 'Sentenced',
  appealed: 'Appealed',
  closed: 'Closed',
  archived: 'Closed',
};

const getCourtPersonnel = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT id, full_name, email, identification_number AS username, personnel_type AS role
      FROM legal_personnel
      WHERE status = 'active'
      ORDER BY personnel_type, full_name
    `);

    const toOption = (row) => ({
      id: row.id,
      value: row.full_name || row.username,
      label: row.full_name || row.username,
      username: row.username,
      email: row.email,
      role: row.role,
    });

    const judges = rows.filter((row) => row.role === 'judge').map(toOption);
    const prosecutors = rows.filter((row) => row.role === 'prosecutor').map(toOption);

    res.json({ success: true, data: { judges, prosecutors, all: rows.map(toOption) } });
  } catch (err) { next(err); }
};

const getCourtDashboard = async (req, res, next) => {
  try {
    const params = [];
    const visibility = addVisibilityFilter(req, params, 'cc');
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS total_court_cases,
        SUM(CASE WHEN status IN ('registered','awaiting_hearing') THEN 1 ELSE 0 END) AS pending_cases,
        SUM(CASE WHEN status = 'in_trial' THEN 1 ELSE 0 END) AS active_hearings,
        SUM(CASE WHEN status IN ('judgment_issued','closed','archived') THEN 1 ELSE 0 END) AS completed_cases,
        SUM(CASE WHEN final_outcome = 'convicted' THEN 1 ELSE 0 END) AS convicted_cases,
        SUM(CASE WHEN final_outcome = 'acquitted' THEN 1 ELSE 0 END) AS acquitted_cases,
        SUM(CASE WHEN status = 'appealed' THEN 1 ELSE 0 END) AS appeals_filed,
        (SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'court' AND u.is_active = 1) AS judges,
        0 AS prosecutors
      FROM court_cases cc
      WHERE 1=1 ${visibility}
    `, params);

    const [byStatus] = await db.query(`SELECT status AS label, COUNT(*) AS value FROM court_cases cc WHERE 1=1 ${visibility} GROUP BY status ORDER BY value DESC`, params);
    const [byCrime] = await db.query(`SELECT crime_category AS label, COUNT(*) AS value FROM court_cases cc WHERE 1=1 ${visibility} GROUP BY crime_category ORDER BY value DESC LIMIT 10`, params);
    const [monthlyActivity] = await db.query(`
      SELECT DATE_FORMAT(registration_date, '%Y-%m') AS label, COUNT(*) AS value
      FROM court_cases cc
      WHERE 1=1 ${visibility}
      GROUP BY DATE_FORMAT(registration_date, '%Y-%m')
      ORDER BY label ASC
      LIMIT 12
    `, params);
    const [recentCases] = await db.query(`
      SELECT cc.*, c.priority
      FROM court_cases cc
      LEFT JOIN cases c ON c.id = cc.police_case_id
      WHERE 1=1 ${visibility}
      ORDER BY cc.registration_date DESC
      LIMIT 12
    `, params);

    res.json({ success: true, data: { stats, byStatus, byCrime, monthlyActivity, recentCases } });
  } catch (err) { next(err); }
};

const getCourtCases = async (req, res, next) => {
  try {
    const {
      status,
      search,
      court_case_number,
      police_case_number,
      ob_number,
      suspect_name,
      complainant_name,
      judge,
      from_date,
      to_date,
      page = 1,
      limit = 20,
    } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = '1=1';
    if (status) { where += ' AND cc.status = ?'; params.push(status); }
    if (court_case_number) { where += ' AND cc.court_case_number LIKE ?'; params.push(`%${court_case_number}%`); }
    if (police_case_number) { where += ' AND cc.police_case_number LIKE ?'; params.push(`%${police_case_number}%`); }
    if (ob_number) { where += ' AND cc.ob_number LIKE ?'; params.push(`%${ob_number}%`); }
    if (complainant_name) { where += ' AND c.complainant_name LIKE ?'; params.push(`%${complainant_name}%`); }
    if (judge) { where += ' AND cc.assigned_judge LIKE ?'; params.push(`%${judge}%`); }
    if (from_date) { where += ' AND cc.registration_date >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND cc.registration_date <= ?'; params.push(to_date); }
    if (suspect_name) {
      where += ` AND EXISTS (
        SELECT 1 FROM case_criminals cs
        JOIN criminals s ON s.id = cs.criminal_id
        WHERE cs.case_id = cc.police_case_id AND s.full_name LIKE ?
      )`;
      params.push(`%${suspect_name}%`);
    }
    if (search) {
      where += ` AND (
        cc.court_case_number LIKE ? OR cc.police_case_number LIKE ? OR cc.ob_number LIKE ?
        OR cc.case_title LIKE ? OR c.complainant_name LIKE ?
        OR EXISTS (
          SELECT 1 FROM case_criminals cs2
          JOIN criminals s2 ON s2.id = cs2.criminal_id
          WHERE cs2.case_id = cc.police_case_id AND s2.full_name LIKE ?
        )
      )`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    where += addVisibilityFilter(req, params, 'cc');
    const [rows] = await db.query(`
      SELECT cc.*, c.priority, c.incident_location, c.complainant_name
      FROM court_cases cc
      LEFT JOIN cases c ON c.id = cc.police_case_id
      WHERE ${where}
      ORDER BY cc.registration_date DESC
      LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM court_cases cc LEFT JOIN cases c ON c.id = cc.police_case_id WHERE ${where}`, params);
    res.json({ success: true, data: rows, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) { next(err); }
};

const getCourtCaseById = async (req, res, next) => {
  try {
    const visibilityParams = [req.params.id];
    const visibility = addVisibilityFilter(req, visibilityParams, 'cc');
    const [[courtCase]] = await db.query(`
      SELECT cc.*, c.priority, c.incident_location, c.complainant_name, c.complainant_phone,
             c.assigned_officer_id, po.full_name AS officer_name
      FROM court_cases cc
      LEFT JOIN cases c ON c.id = cc.police_case_id
      LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
      WHERE cc.id = ? ${visibility}`,
      visibilityParams
    );
    if (!courtCase) return res.status(404).json({ success: false, message: 'Court case not found.' });

    const policeCaseId = courtCase.police_case_id;
    const [criminals] = await db.query(`
      SELECT s.*, cs.role_in_case, cs.status AS case_criminal_status
      FROM criminals s
      JOIN case_criminals cs ON cs.criminal_id = s.id
      WHERE cs.case_id = ? AND cs.status = 'active'`,
      [policeCaseId]
    );
    const [witnesses] = await db.query(`
      SELECT w.*, ws.statement, cw.status AS court_status, cw.testimony, cw.signed_statement_url
      FROM witnesses w
      JOIN witness_statements ws ON ws.witness_id = w.id AND ws.case_id = ?
      LEFT JOIN court_witnesses cw ON cw.court_case_id = ? AND cw.witness_id = w.id
      ORDER BY w.full_name ASC`,
      [policeCaseId, courtCase.id]
    );
    const [evidence] = await db.query(`
      SELECT e.*, cen.notes AS court_notes
      FROM evidence e
      LEFT JOIN court_evidence_notes cen ON cen.court_case_id = ? AND cen.evidence_id = e.id
      WHERE e.case_id = ?`,
      [courtCase.id, policeCaseId]
    );
    const [arrests] = await db.query(`
      SELECT a.*, s.full_name AS suspect_name
      FROM arrests a
      JOIN criminals s ON s.id = a.suspect_id
      WHERE a.case_id = ?`,
      [policeCaseId]
    );
    const [hearings] = await db.query('SELECT * FROM court_hearings WHERE court_case_id = ? ORDER BY hearing_date DESC, hearing_time DESC', [courtCase.id]);
    const [proceedings] = await db.query(`
      SELECT cp.*, ch.hearing_type, ch.hearing_date
      FROM court_proceedings cp
      LEFT JOIN court_hearings ch ON ch.id = cp.hearing_id
      WHERE cp.court_case_id = ?
      ORDER BY cp.proceeding_date DESC`,
      [courtCase.id]
    );
    const [judgments] = await db.query('SELECT * FROM court_judgments WHERE court_case_id = ? ORDER BY decision_date DESC', [courtCase.id]);
    const [sentences] = await db.query(
      `SELECT cs.*, cr.full_name AS defendant_name
         FROM court_sentences cs
         JOIN criminals cr ON cr.id = cs.criminal_id
        WHERE cs.court_case_id = ?
        ORDER BY cs.sentence_date DESC`,
      [courtCase.id]
    );
    const [appeals] = await db.query('SELECT * FROM court_appeals WHERE court_case_id = ? ORDER BY filing_date DESC', [courtCase.id]);
    const [auditTrail] = await db.query(`
      SELECT action, user_id AS performed_by, created_at,
             old_data AS previous_value, new_data AS new_value, entity_type, entity_id
      FROM audit_logs
      WHERE (
        (entity_type = 'court_cases' AND entity_id = ?)
        OR (entity_type = 'court_hearings' AND entity_id IN (SELECT id FROM court_hearings WHERE court_case_id = ?))
        OR (entity_type = 'court_proceedings' AND entity_id IN (SELECT id FROM court_proceedings WHERE court_case_id = ?))
        OR (entity_type = 'court_judgments' AND entity_id IN (SELECT id FROM court_judgments WHERE court_case_id = ?))
        OR (entity_type = 'court_sentences' AND entity_id IN (SELECT id FROM court_sentences WHERE court_case_id = ?))
        OR (entity_type = 'court_appeals' AND entity_id IN (SELECT id FROM court_appeals WHERE court_case_id = ?))
      )
      ORDER BY created_at DESC
      LIMIT 100`,
      [courtCase.id, courtCase.id, courtCase.id, courtCase.id, courtCase.id, courtCase.id]
    );

    res.json({ success: true, data: { courtCase, criminals, suspects: criminals, witnesses, evidence, arrests, hearings, proceedings, judgments, sentences, appeals, auditTrail } });
  } catch (err) { next(err); }
};

const syncCourtCase = async (req, res, next) => {
  try {
    const { police_case_id } = req.body;
    if (!police_case_id) return res.status(400).json({ success: false, message: 'police_case_id is required.' });
    const courtCase = await ensureCourtCaseForPoliceCase(police_case_id, actor(req));
    if (!courtCase) return res.status(409).json({ success: false, message: 'Police case is not ready for court.' });
    res.status(courtCase.alreadyExists ? 200 : 201).json({ success: true, data: courtCase });
  } catch (err) { next(err); }
};

const getCourtCalendar = async (req, res, next) => {
  try {
    const { judge, court_room, hearing_type, case_status, from_date, to_date } = req.query;
    const params = [];
    let where = "ch.status = 'scheduled' AND cc.status NOT IN ('sentenced', 'closed', 'archived')";
    if (judge) { where += ' AND ch.assigned_judge LIKE ?'; params.push(`%${judge}%`); }
    if (court_room) { where += ' AND ch.court_room LIKE ?'; params.push(`%${court_room}%`); }
    if (hearing_type) { where += ' AND ch.hearing_type = ?'; params.push(hearing_type); }
    if (case_status) { where += ' AND cc.status = ?'; params.push(case_status); }
    if (from_date) { where += ' AND ch.hearing_date >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND ch.hearing_date <= ?'; params.push(to_date); }
    where += addVisibilityFilter(req, params, 'cc');

    const [rows] = await db.query(`
      SELECT ch.*, cc.court_case_number, cc.police_case_number, cc.case_title, cc.status AS case_status
      FROM court_hearings ch
      JOIN court_cases cc ON cc.id = ch.court_case_id
      WHERE ${where}
      ORDER BY ch.hearing_date ASC, ch.hearing_time ASC
      LIMIT 250`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getCourtNotifications = async (req, res, next) => {
  try {
    const params = [];
    const visibility = addVisibilityFilter(req, params, 'cc');
    const [newCases] = await db.query(`
      SELECT 'new_case' AS type, 'New court case received' AS title,
             CONCAT(court_case_number, ' - ', case_title) AS message,
             registration_date AS event_date, id AS court_case_id, status
      FROM court_cases cc
      WHERE cc.status = 'registered' ${visibility}
      ORDER BY registration_date DESC
      LIMIT 8`, params);
    const [hearings] = await db.query(`
      SELECT 'hearing_due' AS type,
             CASE WHEN ch.hearing_date = CURDATE() THEN 'Hearing today' ELSE 'Hearing tomorrow' END AS title,
             CONCAT(cc.court_case_number, ' at ', COALESCE(ch.court_room, 'court room pending')) AS message,
             ch.hearing_date AS event_date, cc.id AS court_case_id, cc.status
      FROM court_hearings ch
      JOIN court_cases cc ON cc.id = ch.court_case_id
      WHERE ch.status = 'scheduled'
        AND ch.hearing_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        ${visibility}
      ORDER BY ch.hearing_date ASC, ch.hearing_time ASC
      LIMIT 12`, params);
    const [witnessAbsent] = await db.query(`
      SELECT 'witness_absent' AS type, 'Witness absent' AS title,
             CONCAT(COALESCE(w.full_name, 'Witness'), ' for ', cc.court_case_number) AS message,
             COALESCE(cw.summoned_at, cw.created_at, cc.registration_date) AS event_date, cc.id AS court_case_id, cc.status
      FROM court_witnesses cw
      JOIN court_cases cc ON cc.id = cw.court_case_id
      LEFT JOIN witnesses w ON w.id = cw.witness_id
      WHERE cw.status = 'absent' ${visibility}
      ORDER BY COALESCE(cw.summoned_at, cw.created_at) DESC
      LIMIT 8`, params);
    const [judgmentPending] = await db.query(`
      SELECT 'judgment_pending' AS type, 'Judgment pending' AS title,
             CONCAT(court_case_number, ' has trial activity without judgment') AS message,
             registration_date AS event_date, id AS court_case_id, status
      FROM court_cases cc
      WHERE cc.status = 'in_trial'
        AND NOT EXISTS (SELECT 1 FROM court_judgments cj WHERE cj.court_case_id = cc.id)
        ${visibility}
      ORDER BY registration_date ASC
      LIMIT 8`, params);
    const [appeals] = await db.query(`
      SELECT 'appeal_filed' AS type, 'Appeal filed' AS title,
             CONCAT(ca.filed_by, ' filed appeal for ', cc.court_case_number) AS message,
             ca.filing_date AS event_date, cc.id AS court_case_id, cc.status
      FROM court_appeals ca
      JOIN court_cases cc ON cc.id = ca.court_case_id
      WHERE ca.status = 'pending' ${visibility}
      ORDER BY ca.filing_date DESC
      LIMIT 8`, params);
    const [overdue] = await db.query(`
      SELECT 'case_overdue' AS type, 'Case overdue' AS title,
             CONCAT(court_case_number, ' has been open for more than 60 days') AS message,
             registration_date AS event_date, id AS court_case_id, status
      FROM court_cases cc
      WHERE cc.status NOT IN ('closed','archived')
        AND cc.registration_date < DATE_SUB(CURDATE(), INTERVAL 60 DAY)
        ${visibility}
      ORDER BY registration_date ASC
      LIMIT 8`, params);

    const data = [...hearings, ...newCases, ...witnessAbsent, ...judgmentPending, ...appeals, ...overdue]
      .map((item) => ({ ...item, status_label: friendlyStatus[item.status] || item.status }))
      .slice(0, 30);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

const assignCourtCase = async (req, res, next) => {
  try {
    const { assigned_judge, assigned_prosecutor } = req.body;
    const [[oldCase]] = await db.query('SELECT assigned_judge, assigned_prosecutor, status FROM court_cases WHERE id = ?', [req.params.id]);
    await db.query(
      `UPDATE court_cases
       SET assigned_judge = COALESCE(?, assigned_judge),
           assigned_prosecutor = COALESCE(?, assigned_prosecutor),
           status = CASE WHEN status = 'registered' THEN 'awaiting_hearing' ELSE status END
       WHERE id = ?`,
      [assigned_judge || null, assigned_prosecutor || null, req.params.id]
    );
    const [[newCase]] = await db.query('SELECT assigned_judge, assigned_prosecutor, status FROM court_cases WHERE id = ?', [req.params.id]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: 'ASSIGN_COURT_CASE', entityType: 'court_cases', entityId: Number(req.params.id), oldData: oldCase, newData: newCase, ...auditRequestMeta(req) });
    res.json({ success: true, message: 'Court case assignment updated.' });
  } catch (err) { next(err); }
};

const scheduleHearing = async (req, res, next) => {
  try {
    const { hearing_type, hearing_date, hearing_time, court_room, assigned_judge } = req.body;
    if (!hearing_type || !hearing_date || !hearing_time) {
      return res.status(400).json({ success: false, message: 'hearing_type, hearing_date, and hearing_time are required.' });
    }
    const result = await withTransaction(async (connection) => {
      const [[courtCase]] = await connection.query(
        'SELECT status, closure_date, assigned_judge FROM court_cases WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!courtCase) throw new WorkflowError('Court case not found.', 404);
      if (['closed', 'archived'].includes(courtCase.status)) {
        throw new WorkflowError('A hearing cannot be scheduled for a closed Court Case.');
      }
      if (courtCase.closure_date && hearing_date > String(courtCase.closure_date).slice(0, 10)) {
        throw new WorkflowError('Hearing date cannot be after Court Case closure.');
      }
      const effectiveJudge = assigned_judge || courtCase.assigned_judge || null;
      const [insert] = await connection.query(
        `INSERT INTO court_hearings (court_case_id, hearing_type, hearing_date, hearing_time, court_room, assigned_judge, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [req.params.id, hearing_type, hearing_date, hearing_time, court_room || null, effectiveJudge, actor(req)]
      );
      await connection.query(
        "UPDATE court_cases SET status = 'hearing_scheduled' WHERE id = ? AND status IN ('registered','awaiting_hearing')",
        [req.params.id]
      );
      return insert;
    });
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: 'SCHEDULE_HEARING', entityType: 'court_hearings', entityId: result.insertId, newData: { court_case_id: Number(req.params.id), ...req.body }, ...auditRequestMeta(req) });
    res.status(201).json({ success: true, message: 'Hearing scheduled.', hearingId: result.insertId });
  } catch (err) { next(err); }
};

const updateHearing = async (req, res, next) => {
  try {
    const { hearing_date, hearing_time, court_room, assigned_judge, status } = req.body;
    const oldHearing = await withTransaction(async (connection) => {
      const [[hearing]] = await connection.query(
        `SELECT ch.*, cc.status AS court_case_status, cc.closure_date
           FROM court_hearings ch JOIN court_cases cc ON cc.id = ch.court_case_id
          WHERE ch.id = ? FOR UPDATE`,
        [req.params.hearingId]
      );
      if (!hearing) throw new WorkflowError('Hearing not found.', 404);
      const nextDate = hearing_date || String(hearing.hearing_date).slice(0, 10);
      const nextHearingStatus = status || hearing.status;
      if (hearing.closure_date && nextDate > String(hearing.closure_date).slice(0, 10) && nextHearingStatus !== 'cancelled') {
        throw new WorkflowError('Hearing date cannot be after closure unless the hearing is cancelled.', 400);
      }
      if (['closed', 'archived'].includes(hearing.court_case_status) && nextHearingStatus === 'scheduled') {
        throw new WorkflowError('A hearing for a closed Court Case cannot remain scheduled.');
      }
      await connection.query(
        `UPDATE court_hearings
         SET hearing_date = COALESCE(?, hearing_date), hearing_time = COALESCE(?, hearing_time),
             court_room = COALESCE(?, court_room), assigned_judge = COALESCE(?, assigned_judge),
             status = COALESCE(?, status)
         WHERE id = ?`,
        [hearing_date || null, hearing_time || null, court_room || null, assigned_judge || null, status || null, req.params.hearingId]
      );
      return hearing;
    });
    const [[newHearing]] = await db.query('SELECT * FROM court_hearings WHERE id = ?', [req.params.hearingId]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: 'UPDATE_HEARING', entityType: 'court_hearings', entityId: Number(req.params.hearingId), oldData: oldHearing, newData: newHearing, ...auditRequestMeta(req) });
    res.json({ success: true, message: 'Hearing updated.' });
  } catch (err) { next(err); }
};

const addProceeding = async (req, res, next) => {
  try {
    const { notes, judge_remarks, prosecutor_remarks, defense_remarks } = req.body;
    const [[hearing]] = await db.query(
      `SELECT ch.id, ch.court_case_id, cc.status AS court_case_status
         FROM court_hearings ch JOIN court_cases cc ON cc.id = ch.court_case_id
        WHERE ch.id = ?`,
      [req.params.hearingId]
    );
    if (!hearing) return res.status(404).json({ success: false, message: 'Hearing not found.' });
    if (['closed', 'archived'].includes(hearing.court_case_status)) {
      throw new WorkflowError('Proceedings cannot be added to a closed Court Case.');
    }
    const [result] = await db.query(
      `INSERT INTO court_proceedings (court_case_id, hearing_id, proceeding_date, notes, judge_remarks, prosecutor_remarks, defense_remarks, created_by)
       VALUES (?, ?, CURDATE(), ?, ?, ?, ?, ?)`,
      [hearing.court_case_id, hearing.id, notes || null, judge_remarks || null, prosecutor_remarks || null, defense_remarks || null, actor(req)]
    );
    await db.query("UPDATE court_cases SET status = 'in_trial' WHERE id = ?", [hearing.court_case_id]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: 'ADD_COURT_PROCEEDING', entityType: 'court_proceedings', entityId: result.insertId, newData: { court_case_id: hearing.court_case_id, hearing_id: hearing.id, ...req.body }, ...auditRequestMeta(req) });
    res.status(201).json({ success: true, message: 'Proceeding recorded.', proceedingId: result.insertId });
  } catch (err) { next(err); }
};

const saveJudgment = async (req, res, next) => {
  try {
    const { judge_name, decision_date, decision_type, judgment_summary } = req.body;
    if (!decision_type || !judgment_summary) {
      return res.status(400).json({ success: false, message: 'decision_type and judgment_summary are required.' });
    }
    const saved = await withTransaction(async (connection) => {
      const [[courtCase]] = await connection.query(
        'SELECT police_case_id, status, closure_date, assigned_judge FROM court_cases WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!courtCase) throw new WorkflowError('Court case not found.', 404);
      if (['closed', 'archived'].includes(courtCase.status)) {
        throw new WorkflowError('A judgment cannot be added to a closed Court Case.');
      }
      const effectiveDate = decision_date || new Date().toISOString().slice(0, 10);
      if (courtCase.closure_date && effectiveDate > String(courtCase.closure_date).slice(0, 10)) {
        throw new WorkflowError('Judgment decision date cannot be after closure date.');
      }
      const effectiveJudgeName = judge_name || courtCase.assigned_judge || req.user.full_name || req.user.username;
      const [insert] = await connection.query(
        `INSERT INTO court_judgments (court_case_id, judge_name, decision_date, decision_type, judgment_summary, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.params.id, effectiveJudgeName, effectiveDate, decision_type, judgment_summary, actor(req)]
      );
      await connection.query("UPDATE court_cases SET status = 'judgment_issued', final_outcome = ? WHERE id = ?", [decision_type, req.params.id]);
      await connection.query("UPDATE cases SET status = 'court_decided' WHERE id = ?", [courtCase.police_case_id]);
      await connection.query(
        `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
         VALUES (?, ?, 'JUDGMENT_ISSUED', ?, 'court_decided')`,
        [courtCase.police_case_id, actor(req), `Court judgment issued: ${decision_type}.`]
      );
      return { insert, courtCase };
    });
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: 'SAVE_JUDGMENT', entityType: 'court_judgments', entityId: saved.insert.insertId, newData: { court_case_id: Number(req.params.id), ...req.body }, ...auditRequestMeta(req) });
    res.status(201).json({ success: true, message: 'Judgment saved.', judgmentId: saved.insert.insertId });
  } catch (err) { next(err); }
};

const issueSentence = async (req, res, next) => {
  try {
    const {
      criminal_id,
      sentence_type,
      duration,
      duration_value,
      duration_unit,
      sentence_period_value,
      sentence_period_unit,
      sentence_start_date,
      expected_release_date,
      fine_amount,
      sentence_date
    } = req.body;

    if (!criminal_id || !sentence_type) {
      return res.status(400).json({ success: false, message: 'criminal_id and sentence_type are required.' });
    }
    validateSentence({ sentence_type, duration, fine_amount });
    const result = await withTransaction(async (connection) => {
      const [[defendant]] = await connection.query(
        `SELECT cr.id, cr.full_name, cc.police_case_id, cc.status, cc.closure_date
           FROM court_cases cc
           JOIN case_criminals link ON link.case_id = cc.police_case_id AND link.criminal_id = ? AND link.status = 'active'
           JOIN criminals cr ON cr.id = link.criminal_id
          WHERE cc.id = ? FOR UPDATE`,
        [criminal_id, req.params.id]
      );
      if (!defendant) {
        throw new WorkflowError('The sentenced defendant must belong to the linked Police Case.', 400, 'INVALID_DEFENDANT');
      }
      if (['closed', 'archived'].includes(defendant.status)) {
        throw new WorkflowError('A sentence cannot be added to a closed Court Case.');
      }
      const [[judgment]] = await connection.query(
        `SELECT decision_type, judgment_summary FROM court_judgments
          WHERE court_case_id = ? ORDER BY decision_date DESC, id DESC LIMIT 1 FOR UPDATE`,
        [req.params.id]
      );
      if (!judgment || judgment.decision_type !== 'convicted') {
        throw new WorkflowError('A conviction judgment is required before sentencing.');
      }
      validateJudgmentSentenceConsistency(judgment.judgment_summary, { sentence_type, duration, fine_amount });

      const pVal = sentence_period_value ? Number(sentence_period_value) : (duration_value ? Number(duration_value) : null);
      const pUnit = sentence_period_unit || duration_unit || 'days';
      const sDate = sentence_start_date || sentence_date || new Date().toISOString().slice(0, 10);
      let expRelease = expected_release_date || null;

      if (!expRelease && pVal && sDate) {
        const start = new Date(`${sDate}T00:00:00Z`);
        if (!isNaN(start.getTime())) {
          if (pUnit === 'days' || pUnit === 'cisho') start.setUTCDate(start.getUTCDate() + pVal);
          else if (pUnit === 'months' || pUnit === 'bilood') start.setUTCMonth(start.getUTCMonth() + pVal);
          else if (pUnit === 'years' || pUnit === 'sano') start.setUTCFullYear(start.getUTCFullYear() + pVal);
          expRelease = start.toISOString().slice(0, 10);
        }
      }

      const durationText = duration || (pVal ? `${pVal} ${pUnit}` : null);

      const [insert] = await connection.query(
        `INSERT INTO court_sentences
          (court_case_id, criminal_id, defendant_name, sentence_type, duration, fine_amount, sentence_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURDATE()), ?)`,
        [
          req.params.id,
          criminal_id,
          req.body.defendant_name || defendant.full_name,
          sentence_type,
          durationText,
          fine_amount || null,
          sDate,
          actor(req)
        ]
      );
      await connection.query("UPDATE court_cases SET status = 'sentenced' WHERE id = ? AND status = 'judgment_issued'", [req.params.id]);

      const [arrestUpdate] = await connection.query(
        `UPDATE arrests
         SET court_decision = 'convicted',
             sentence_status = CASE WHEN ? IN ('imprisonment', 'both') THEN 'serving' ELSE sentence_status END,
             sentence_period_value = COALESCE(?, sentence_period_value),
             sentence_period_unit = COALESCE(?, sentence_period_unit),
             sentence_start_date = COALESCE(?, sentence_start_date),
             expected_release_date = COALESCE(?, expected_release_date),
             charges = CASE WHEN LOWER(COALESCE(charges,'')) IN ('','not charged','not_charged') THEN 'convicted by court' ELSE charges END
         WHERE case_id = ? AND suspect_id = ?`,
        [sentence_type, pVal, pUnit, sDate, expRelease, defendant.police_case_id, criminal_id]
      );

      if (arrestUpdate.affectedRows === 0 && ['imprisonment', 'both'].includes(sentence_type)) {
        const [[policeCase]] = await connection.query(
          'SELECT district_id FROM cases WHERE id = ?',
          [defendant.police_case_id]
        );
        await connection.query(
          `INSERT INTO arrests
            (case_id, suspect_id, police_station_id, arrested_by, arrest_date, arrest_location,
             charges, court_decision, court_decision_notes, sentence_start_date, sentence_period_value, sentence_period_unit, expected_release_date,
             sentence_status, bail_status, notes)
           VALUES (?, ?, ?, ?, COALESCE(?, CURDATE()), 'Court commitment',
                   'convicted by court', 'convicted', ?, COALESCE(?, CURDATE()), ?, ?, ?,
                   'serving', 'no_bail', 'Automatically created from an imprisonment sentence.')`,
          [
            defendant.police_case_id,
            criminal_id,
            policeCase?.district_id || null,
            actor(req),
            sDate,
            judgment.judgment_summary,
            sDate,
            pVal,
            pUnit,
            expRelease
          ]
        );
      }
      await syncCriminalCustodyStatus(connection, criminal_id);
      return insert;
    });
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: 'ISSUE_SENTENCE', entityType: 'court_sentences', entityId: result.insertId, newData: { court_case_id: Number(req.params.id), ...req.body }, ...auditRequestMeta(req) });
    res.status(201).json({ success: true, message: 'Sentence issued.', sentenceId: result.insertId });
  } catch (err) { next(err); }
};

const registerAppeal = async (req, res, next) => {
  try {
    const { filed_by, appeal_reason, filing_date } = req.body;
    if (!filed_by || !appeal_reason) {
      return res.status(400).json({ success: false, message: 'filed_by and appeal_reason are required.' });
    }
    const result = await withTransaction(async (connection) => {
      const [[courtCase]] = await connection.query(
        'SELECT id, status FROM court_cases WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!courtCase) throw new WorkflowError('Court case not found.', 404);
      const [[activeAppeal]] = await connection.query(
        "SELECT id FROM court_appeals WHERE court_case_id = ? AND status IN ('pending','approved') LIMIT 1 FOR UPDATE",
        [req.params.id]
      );
      if (activeAppeal) throw new WorkflowError('An active appeal already exists.');
      const [insert] = await connection.query(
        `INSERT INTO court_appeals (court_case_id, filed_by, appeal_reason, filing_date, status, created_by)
         VALUES (?, ?, ?, COALESCE(?, CURDATE()), 'pending', ?)`,
        [req.params.id, filed_by, appeal_reason, filing_date || null, actor(req)]
      );
      await connection.query("UPDATE court_cases SET status = 'appealed' WHERE id = ?", [req.params.id]);
      return insert;
    });
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: 'REGISTER_APPEAL', entityType: 'court_appeals', entityId: result.insertId, newData: { court_case_id: Number(req.params.id), ...req.body }, ...auditRequestMeta(req) });
    res.status(201).json({ success: true, message: 'Appeal registered.', appealId: result.insertId });
  } catch (err) { next(err); }
};

const updateCourtWitness = async (req, res, next) => {
  try {
    const { status, testimony } = req.body;
    if (!['summoned', 'present', 'absent'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid witness status is required.' });
    }
    const [[linked]] = await db.query(
      `SELECT cc.id
         FROM court_cases cc
         JOIN witness_statements ws ON ws.case_id = cc.police_case_id AND ws.witness_id = ?
        WHERE cc.id = ?`,
      [req.params.witnessId, req.params.id]
    );
    if (!linked) return res.status(404).json({ success: false, message: 'Witness is not linked to this court case.' });

    const [[existing]] = await db.query(
      'SELECT * FROM court_witnesses WHERE court_case_id = ? AND witness_id = ? LIMIT 1',
      [req.params.id, req.params.witnessId]
    );
    let entityId;
    if (existing) {
      await db.query(
        `UPDATE court_witnesses
            SET status = ?, testimony = COALESCE(?, testimony),
                summoned_at = CASE WHEN ? = 'summoned' THEN COALESCE(summoned_at, NOW()) ELSE summoned_at END
          WHERE id = ?`,
        [status, testimony || null, status, existing.id]
      );
      entityId = existing.id;
    } else {
      const [result] = await db.query(
        `INSERT INTO court_witnesses (court_case_id, witness_id, status, testimony, summoned_at)
         VALUES (?, ?, ?, ?, CASE WHEN ? = 'summoned' THEN NOW() ELSE NULL END)`,
        [req.params.id, req.params.witnessId, status, testimony || null, status]
      );
      entityId = result.insertId;
    }
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: 'UPDATE_COURT_WITNESS', entityType: 'court_witnesses', entityId, oldData: existing || null, newData: { status, testimony }, ...auditRequestMeta(req) });
    res.json({ success: true, message: 'Court witness updated.' });
  } catch (err) { next(err); }
};

const decideAppeal = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Appeal decision must be approved or rejected.' });
    }
    const [[appeal]] = await db.query('SELECT * FROM court_appeals WHERE id = ?', [req.params.appealId]);
    if (!appeal) return res.status(404).json({ success: false, message: 'Appeal not found.' });
    if (appeal.status !== 'pending') return res.status(409).json({ success: false, message: 'This appeal has already been decided.' });
    await db.query('UPDATE court_appeals SET status = ? WHERE id = ?', [status, req.params.appealId]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: status === 'approved' ? 'APPROVE_APPEAL' : 'REJECT_APPEAL', entityType: 'court_appeals', entityId: Number(req.params.appealId), oldData: appeal, newData: { ...appeal, status }, ...auditRequestMeta(req) });
    res.json({ success: true, message: `Appeal ${status}.` });
  } catch (err) { next(err); }
};

const closeCourtCase = async (req, res, next) => {
  try {
    const { closure_reason, final_outcome, archive = false } = req.body;
    const [[courtCase]] = await db.query('SELECT police_case_id, status, final_outcome, closure_reason FROM court_cases WHERE id = ?', [req.params.id]);
    await withTransaction((connection) => closeCourtWorkflow(connection, {
      courtCaseId: Number(req.params.id),
      closureReason: closure_reason,
      finalOutcome: final_outcome,
      archive,
      actor: actor(req),
    }));
    const [[closedCase]] = await db.query('SELECT status, final_outcome, closure_reason, closure_date FROM court_cases WHERE id = ?', [req.params.id]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email, action: archive ? 'ARCHIVE_COURT_CASE' : 'CLOSE_COURT_CASE', entityType: 'court_cases', entityId: Number(req.params.id), oldData: courtCase, newData: closedCase, ...auditRequestMeta(req) });
    res.json({ success: true, message: archive ? 'Court case archived.' : 'Court case closed.' });
  } catch (err) { next(err); }
};

module.exports = {
  getCourtDashboard,
  getCourtPersonnel,
  getCourtCases,
  getCourtCaseById,
  getCourtCalendar,
  getCourtNotifications,
  syncCourtCase,
  assignCourtCase,
  scheduleHearing,
  updateHearing,
  addProceeding,
  saveJudgment,
  issueSentence,
  registerAppeal,
  updateCourtWitness,
  decideAppeal,
  closeCourtCase,
};
