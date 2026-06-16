'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { ensureCidCaseForPoliceCase } = require('../services/cidService');

const actor = (req) => req.user?.username || String(req.user?.id || 'system');
const role = (req) => String(req.user?.role || '').toLowerCase();
const actorNames = (req) => [...new Set([req.user?.username, req.user?.fullName, req.user?.full_name, req.user?.email].filter(Boolean))];

const addVisibilityFilter = (req, params, alias = 'cid') => {
  if (['admin', 'cid', 'cid_director', 'cid_supervisor'].includes(role(req))) return '';
  const names = actorNames(req);
  if (!names.length) return ' AND 1=0';
  params.push(...names);
  return ` AND ${alias}.assigned_officer IN (${names.map(() => '?').join(',')})`;
};

const auditMeta = (req) => ({ ipAddress: req.ip, userAgent: req.get?.('user-agent') || null });

const getCidDashboard = async (req, res, next) => {
  try {
    const params = [];
    const visibility = addVisibilityFilter(req, params, 'cid');
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*) AS total_cid_cases,
        SUM(CASE WHEN investigation_status IN ('open','under_investigation','evidence_collection','witness_interviews','suspect_tracking','arrest_made') THEN 1 ELSE 0 END) AS active_investigations,
        SUM(CASE WHEN investigation_status IN ('open','supervisor_review') THEN 1 ELSE 0 END) AS pending_investigations,
        SUM(CASE WHEN investigation_status IN ('investigation_completed','approved','sent_to_prosecutor','sent_to_court') THEN 1 ELSE 0 END) AS completed_investigations,
        (SELECT COUNT(*) FROM evidence e JOIN cid_cases c2 ON c2.police_case_id = e.case_id WHERE 1=1 ${visibility.replaceAll('cid.', 'c2.')}) AS evidence_collected,
        (SELECT COUNT(*) FROM case_suspects cs JOIN cid_cases c2 ON c2.police_case_id = cs.case_id WHERE 1=1 ${visibility.replaceAll('cid.', 'c2.')}) AS suspects_identified,
        (SELECT COUNT(*) FROM arrests a JOIN cid_cases c2 ON c2.police_case_id = a.case_id WHERE 1=1 ${visibility.replaceAll('cid.', 'c2.')}) AS arrested_suspects,
        SUM(CASE WHEN investigation_status = 'sent_to_prosecutor' THEN 1 ELSE 0 END) AS cases_sent_to_prosecutor,
        SUM(CASE WHEN investigation_status = 'sent_to_court' THEN 1 ELSE 0 END) AS cases_sent_to_court
      FROM cid_cases cid
      WHERE 1=1 ${visibility}
    `, [...params, ...params, ...params, params].flat());

    const [byStatus] = await db.query(`SELECT investigation_status AS label, COUNT(*) AS value FROM cid_cases cid WHERE 1=1 ${visibility} GROUP BY investigation_status ORDER BY value DESC`, params);
    const [byCrime] = await db.query(`SELECT crime_category AS label, COUNT(*) AS value FROM cid_cases cid WHERE 1=1 ${visibility} GROUP BY crime_category ORDER BY value DESC LIMIT 10`, params);
    const [monthly] = await db.query(`
      SELECT DATE_FORMAT(assigned_date, '%Y-%m') AS label, COUNT(*) AS value
      FROM cid_cases cid
      WHERE 1=1 ${visibility}
      GROUP BY DATE_FORMAT(assigned_date, '%Y-%m')
      ORDER BY label ASC
      LIMIT 12`, params);
    const [officers] = await db.query(`
      SELECT COALESCE(assigned_officer, 'Unassigned') AS label, COUNT(*) AS value
      FROM cid_cases cid
      WHERE 1=1 ${visibility}
      GROUP BY assigned_officer
      ORDER BY value DESC
      LIMIT 10`, params);
    res.json({ success: true, data: { stats, byStatus, byCrime, monthly, officers } });
  } catch (err) { next(err); }
};

const getCidCases = async (req, res, next) => {
  try {
    const { status, priority, search, officer, from_date, to_date, page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = '1=1';
    if (status) { where += ' AND cid.investigation_status = ?'; params.push(status); }
    if (priority) { where += ' AND cid.priority = ?'; params.push(priority); }
    if (officer) { where += ' AND cid.assigned_officer LIKE ?'; params.push(`%${officer}%`); }
    if (from_date) { where += ' AND cid.assigned_date >= ?'; params.push(from_date); }
    if (to_date) { where += ' AND cid.assigned_date <= ?'; params.push(to_date); }
    if (search) {
      where += ' AND (cid.case_number LIKE ? OR cid.ob_number LIKE ? OR cid.case_title LIKE ? OR c.complainant_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    where += addVisibilityFilter(req, params, 'cid');

    const [rows] = await db.query(`
      SELECT cid.*, c.complainant_name, c.incident_location
      FROM cid_cases cid
      JOIN cases c ON c.id = cid.police_case_id
      WHERE ${where}
      ORDER BY cid.updated_at DESC, cid.assigned_date DESC
      LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM cid_cases cid JOIN cases c ON c.id = cid.police_case_id WHERE ${where}`, params);
    res.json({ success: true, data: rows, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (err) { next(err); }
};

const syncCidCase = async (req, res, next) => {
  try {
    const cidCase = await ensureCidCaseForPoliceCase(req.body.police_case_id, actor(req));
    if (!cidCase) return res.status(409).json({ success: false, message: 'Police case is not assigned to CID.' });
    res.status(cidCase.alreadyExists ? 200 : 201).json({ success: true, data: cidCase });
  } catch (err) { next(err); }
};

const getCidCaseById = async (req, res, next) => {
  try {
    const params = [req.params.id];
    const visibility = addVisibilityFilter(req, params, 'cid');
    const [[cidCase]] = await db.query(`
      SELECT cid.*, c.description, c.incident_date, c.incident_location, c.complainant_name,
             c.complainant_phone, c.status AS police_status
      FROM cid_cases cid
      JOIN cases c ON c.id = cid.police_case_id
      WHERE cid.id = ? ${visibility}`,
      params
    );
    if (!cidCase) return res.status(404).json({ success: false, message: 'CID case not found.' });

    const caseId = cidCase.police_case_id;
    const [progress] = await db.query('SELECT * FROM cid_progress_notes WHERE cid_case_id = ? ORDER BY created_at DESC', [cidCase.id]);
    const [crimeScenes] = await db.query('SELECT * FROM cid_crime_scenes WHERE cid_case_id = ? ORDER BY date_visited DESC', [cidCase.id]);
    const [reports] = await db.query('SELECT * FROM cid_reports WHERE cid_case_id = ? ORDER BY submitted_at DESC', [cidCase.id]);
    const [evidence] = await db.query('SELECT * FROM evidence WHERE case_id = ? ORDER BY created_at DESC', [caseId]);
    const [custody] = await db.query(`
      SELECT coc.*, e.evidence_number, e.title
      FROM chain_of_custody coc
      JOIN evidence e ON e.id = coc.evidence_id
      WHERE e.case_id = ?
      ORDER BY coc.transfer_date DESC`, [caseId]);
    const [suspects] = await db.query(`
      SELECT s.*, cs.role_in_case, cs.status AS case_status
      FROM suspects s JOIN case_suspects cs ON cs.suspect_id = s.id
      WHERE cs.case_id = ?`, [caseId]);
    const [witnesses] = await db.query(`
      SELECT w.*, ws.statement, ws.statement_date, ws.taken_by
      FROM witnesses w JOIN witness_statements ws ON ws.witness_id = w.id
      WHERE ws.case_id = ?`, [caseId]);
    const [arrests] = await db.query(`
      SELECT a.*, s.full_name AS suspect_name
      FROM arrests a JOIN suspects s ON s.id = a.suspect_id
      WHERE a.case_id = ?`, [caseId]);
    const [auditTrail] = await db.query(`
      SELECT action, user_id AS performed_by, created_at, old_data AS previous_value, new_data AS new_value, entity_type, entity_id
      FROM audit_logs
      WHERE (entity_type = 'cid_cases' AND entity_id = ?)
         OR (entity_type = 'cid_progress_notes' AND entity_id IN (SELECT id FROM cid_progress_notes WHERE cid_case_id = ?))
         OR (entity_type = 'cid_crime_scenes' AND entity_id IN (SELECT id FROM cid_crime_scenes WHERE cid_case_id = ?))
         OR (entity_type = 'cid_reports' AND entity_id IN (SELECT id FROM cid_reports WHERE cid_case_id = ?))
      ORDER BY created_at DESC
      LIMIT 100`, [cidCase.id, cidCase.id, cidCase.id, cidCase.id]);

    res.json({ success: true, data: { cidCase, progress, crimeScenes, reports, evidence, custody, suspects, witnesses, arrests, auditTrail } });
  } catch (err) { next(err); }
};

const assignCidCase = async (req, res, next) => {
  try {
    const { assigned_officer, supervisor } = req.body;
    const [[oldCase]] = await db.query('SELECT assigned_officer, supervisor, assignment_status FROM cid_cases WHERE id = ?', [req.params.id]);
    await db.query(
      `UPDATE cid_cases
       SET assigned_officer = COALESCE(?, assigned_officer),
           supervisor = COALESCE(?, supervisor),
           assignment_status = CASE WHEN assignment_status = 'assigned' THEN 'accepted' ELSE assignment_status END,
           updated_at = NOW()
       WHERE id = ?`,
      [assigned_officer || null, supervisor || null, req.params.id]
    );
    const [[newCase]] = await db.query('SELECT assigned_officer, supervisor, assignment_status FROM cid_cases WHERE id = ?', [req.params.id]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ASSIGN_CID_CASE', entityType: 'cid_cases', entityId: Number(req.params.id), oldData: oldCase, newData: newCase, ...auditMeta(req) });
    res.json({ success: true, message: 'CID assignment updated.' });
  } catch (err) { next(err); }
};

const acknowledgeCidCase = async (req, res, next) => {
  try {
    const [[oldCase]] = await db.query('SELECT assignment_status FROM cid_cases WHERE id = ?', [req.params.id]);
    if (!oldCase) return res.status(404).json({ success: false, message: 'CID case not found.' });
    if (oldCase.assignment_status !== 'assigned') {
      return res.json({ success: true, message: 'CID case already acknowledged.' });
    }

    await db.query("UPDATE cid_cases SET assignment_status = 'accepted', updated_at = NOW() WHERE id = ?", [req.params.id]);
    await writeAuditLog({
      userId: actor(req),
      userEmail: req.user.email || req.user.username,
      action: 'ACKNOWLEDGE_CID_CASE',
      entityType: 'cid_cases',
      entityId: Number(req.params.id),
      oldData: oldCase,
      newData: { assignment_status: 'accepted' },
      ...auditMeta(req),
    });
    res.json({ success: true, message: 'CID case acknowledged.' });
  } catch (err) { next(err); }
};

const updateInvestigation = async (req, res, next) => {
  try {
    const { investigation_status, findings, recommendations, progress_note } = req.body;
    const [[oldCase]] = await db.query('SELECT investigation_status, findings, recommendations FROM cid_cases WHERE id = ?', [req.params.id]);
    await db.query(
      `UPDATE cid_cases
       SET investigation_status = COALESCE(?, investigation_status),
           findings = COALESCE(?, findings),
           recommendations = COALESCE(?, recommendations),
           investigation_started_at = COALESCE(investigation_started_at, NOW()),
           updated_at = NOW()
       WHERE id = ?`,
      [investigation_status || null, findings || null, recommendations || null, req.params.id]
    );
    if (progress_note) {
      const [note] = await db.query(
        `INSERT INTO cid_progress_notes (cid_case_id, note, status, created_by) VALUES (?, ?, ?, ?)`,
        [req.params.id, progress_note, investigation_status || oldCase?.investigation_status || null, actor(req)]
      );
      await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ADD_CID_PROGRESS', entityType: 'cid_progress_notes', entityId: note.insertId, newData: { note: progress_note, status: investigation_status }, ...auditMeta(req) });
    }
    const [[newCase]] = await db.query('SELECT investigation_status, findings, recommendations FROM cid_cases WHERE id = ?', [req.params.id]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'UPDATE_CID_INVESTIGATION', entityType: 'cid_cases', entityId: Number(req.params.id), oldData: oldCase, newData: newCase, ...auditMeta(req) });
    res.json({ success: true, message: 'Investigation updated.' });
  } catch (err) { next(err); }
};

const addCrimeScene = async (req, res, next) => {
  try {
    const { location, date_visited, observations, scene_photos, collected_evidence } = req.body;
    if (!location) return res.status(400).json({ success: false, message: 'location is required.' });
    const [result] = await db.query(
      `INSERT INTO cid_crime_scenes (cid_case_id, location, date_visited, officer, observations, scene_photos, collected_evidence, created_by)
       VALUES (?, ?, COALESCE(?, CURDATE()), ?, ?, ?, ?, ?)`,
      [req.params.id, location, date_visited || null, actor(req), observations || null, scene_photos || null, collected_evidence || null, actor(req)]
    );
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ADD_CRIME_SCENE', entityType: 'cid_crime_scenes', entityId: result.insertId, newData: req.body, ...auditMeta(req) });
    res.status(201).json({ success: true, message: 'Crime scene recorded.', crimeSceneId: result.insertId });
  } catch (err) { next(err); }
};

const submitReport = async (req, res, next) => {
  try {
    const { report_title, case_summary, activities, evidence_summary, witness_summary, suspect_analysis, findings, recommendations } = req.body;
    if (!report_title || !findings) return res.status(400).json({ success: false, message: 'report_title and findings are required.' });
    const [result] = await db.query(
      `INSERT INTO cid_reports
        (cid_case_id, report_title, case_summary, activities, evidence_summary, witness_summary, suspect_analysis, findings, recommendations, submitted_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, report_title, case_summary || null, activities || null, evidence_summary || null, witness_summary || null, suspect_analysis || null, findings, recommendations || null, actor(req)]
    );
    await db.query("UPDATE cid_cases SET investigation_status = 'supervisor_review', updated_at = NOW() WHERE id = ?", [req.params.id]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'SUBMIT_CID_REPORT', entityType: 'cid_reports', entityId: result.insertId, newData: req.body, ...auditMeta(req) });
    res.status(201).json({ success: true, message: 'Investigation report submitted for supervisor review.', reportId: result.insertId });
  } catch (err) { next(err); }
};

const reviewInvestigation = async (req, res, next) => {
  try {
    const { decision, notes } = req.body;
    const nextStatus = {
      approved: 'approved',
      rejected: 'rejected',
      additional_investigation: 'under_investigation',
      returned: 'under_investigation',
    }[decision];
    if (!nextStatus) return res.status(400).json({ success: false, message: 'decision must be approved, rejected, additional_investigation, or returned.' });
    const [[oldCase]] = await db.query('SELECT investigation_status, supervisor_notes FROM cid_cases WHERE id = ?', [req.params.id]);
    await db.query('UPDATE cid_cases SET investigation_status = ?, supervisor_notes = ?, updated_at = NOW() WHERE id = ?', [nextStatus, notes || null, req.params.id]);
    const [[newCase]] = await db.query('SELECT investigation_status, supervisor_notes FROM cid_cases WHERE id = ?', [req.params.id]);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'CID_SUPERVISOR_REVIEW', entityType: 'cid_cases', entityId: Number(req.params.id), oldData: oldCase, newData: newCase, ...auditMeta(req) });
    res.json({ success: true, message: 'Supervisor review saved.' });
  } catch (err) { next(err); }
};

const forwardToProsecutor = async (req, res, next) => {
  try {
    const [[cidCase]] = await db.query('SELECT * FROM cid_cases WHERE id = ?', [req.params.id]);
    if (!cidCase) return res.status(404).json({ success: false, message: 'CID case not found.' });
    if (cidCase.investigation_status !== 'approved') {
      return res.status(409).json({ success: false, message: 'Investigation must be approved before forwarding to prosecutor.' });
    }
    await db.query("UPDATE cid_cases SET investigation_status = 'sent_to_prosecutor', prosecutor_forwarded_at = NOW(), updated_at = NOW() WHERE id = ?", [req.params.id]);
    await db.query("UPDATE cases SET status = 'ready_for_court' WHERE id = ?", [cidCase.police_case_id]);
    await db.query(
      `INSERT INTO referrals (case_id, referred_by, referred_to_role, reason, notes, status)
       VALUES (?, ?, 'court', 'CID approved investigation forwarded to prosecutor liaison.', ?, 'completed')`,
      [cidCase.police_case_id, actor(req), req.body.notes || null]
    );
    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
       VALUES (?, ?, 'CID_FORWARDED_TO_PROSECUTOR', 'CID investigation approved and forwarded to prosecutor liaison.', 'ready_for_court')`,
      [cidCase.police_case_id, actor(req)]
    );
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'CID_FORWARD_TO_PROSECUTOR', entityType: 'cid_cases', entityId: Number(req.params.id), newData: { status: 'sent_to_prosecutor' }, ...auditMeta(req) });
    res.json({ success: true, message: 'CID investigation forwarded to prosecutor liaison.' });
  } catch (err) { next(err); }
};

module.exports = {
  getCidDashboard,
  getCidCases,
  syncCidCase,
  getCidCaseById,
  assignCidCase,
  acknowledgeCidCase,
  updateInvestigation,
  addCrimeScene,
  submitReport,
  reviewInvestigation,
  forwardToProsecutor,
};
