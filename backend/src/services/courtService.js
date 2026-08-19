'use strict';

const db = require('../config/database');

const COURT_READY_STATUSES = new Set([
  'ready_for_court',
  'forwarded_to_court',
  'approved_for_court',
  'referred_to_court',
]);

const isCourtReadyStatus = (status) => COURT_READY_STATUSES.has(String(status || '').toLowerCase());

const generateCourtCaseNumber = async (executor = db) => {
  const year = new Date().getFullYear();
  const [[row]] = await executor.query(
    'SELECT COUNT(*) AS count FROM court_cases WHERE YEAR(registration_date) = ?',
    [year]
  );
  return `CRT-${year}-${String(Number(row.count || 0) + 1).padStart(5, '0')}`;
};

const ensureCourtCaseForPoliceCase = async (caseId, actor = 'system', executor = db) => {
  const [[policeCase]] = await executor.query(
    `SELECT c.*, COALESCE(c.title, c.case_title) AS resolved_title
     FROM cases c
     WHERE c.id = ?`,
    [caseId]
  );
  if (!policeCase || !isCourtReadyStatus(policeCase.status)) return null;

  const [[existing]] = await executor.query('SELECT * FROM court_cases WHERE police_case_id = ?', [caseId]);
  if (existing) {
    if (['closed', 'archived'].includes(existing.status)) {
      return { ...existing, alreadyExists: true, terminal: true };
    }
    const nextStatus = existing.status === 'remanded_to_investigator' ? 'returned_from_remand' : existing.status;
    await executor.query(
      `UPDATE court_cases
       SET police_case_number = ?, ob_number = ?, case_title = ?, crime_category = ?,
           case_description = ?, source_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        policeCase.case_number,
        policeCase.ob_number,
        policeCase.resolved_title,
        policeCase.case_type || policeCase.incident_type || 'General',
        policeCase.description || null,
        policeCase.status,
        nextStatus,
        existing.id,
      ]
    );
    if (existing.status === 'remanded_to_investigator') {
      await executor.query(
        `UPDATE court_remands
         SET status = 'returned', returned_at = COALESCE(returned_at, NOW()), return_notes = COALESCE(return_notes, 'Kiiska dib ayaa loogu gudbiyey maxkamadda.')
         WHERE court_case_id = ? AND status = 'pending'`,
        [existing.id]
      );
    }
    return { ...existing, status: nextStatus, alreadyExists: true };
  }

  const courtCaseNumber = await generateCourtCaseNumber(executor);
  const [result] = await executor.query(
    `INSERT INTO court_cases (
     court_case_number, police_case_id, police_case_number, ob_number, case_title,
       crime_category, case_description, source_status, status, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'court_received', ?)`,
    [
      courtCaseNumber,
      policeCase.id,
      policeCase.case_number,
      policeCase.ob_number,
      policeCase.resolved_title,
      policeCase.case_type || policeCase.incident_type || 'General',
      policeCase.description || null,
      policeCase.status,
      actor,
    ]
  );

  await executor.query(
    `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
     VALUES (?, ?, 'COURT_CASE_CREATED', ?, ?)`,
    [caseId, actor, `Court case ${courtCaseNumber} created automatically.`, policeCase.status]
  );

  return { id: result.insertId, court_case_number: courtCaseNumber, alreadyExists: false };
};

module.exports = {
  isCourtReadyStatus,
  generateCourtCaseNumber,
  ensureCourtCaseForPoliceCase,
};
