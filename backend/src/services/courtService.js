'use strict';

const db = require('../config/database');

const COURT_READY_STATUSES = new Set([
  'ready_for_court',
  'forwarded_to_court',
  'approved_for_court',
  'referred_to_court',
]);

const isCourtReadyStatus = (status) => COURT_READY_STATUSES.has(String(status || '').toLowerCase());

const generateCourtCaseNumber = async () => {
  const year = new Date().getFullYear();
  const [[row]] = await db.query(
    'SELECT COUNT(*) AS count FROM court_cases WHERE YEAR(registration_date) = ?',
    [year]
  );
  return `CRT-${year}-${String(Number(row.count || 0) + 1).padStart(5, '0')}`;
};

const ensureCourtCaseForPoliceCase = async (caseId, actor = 'system') => {
  const [[policeCase]] = await db.query(
    `SELECT c.*, COALESCE(c.title, c.case_title) AS resolved_title
     FROM cases c
     WHERE c.id = ?`,
    [caseId]
  );
  if (!policeCase || !isCourtReadyStatus(policeCase.status)) return null;

  const [[existing]] = await db.query('SELECT * FROM court_cases WHERE police_case_id = ?', [caseId]);
  if (existing) {
    await db.query(
      `UPDATE court_cases
       SET police_case_number = ?, ob_number = ?, case_title = ?, crime_category = ?,
           case_description = ?, source_status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        policeCase.case_number,
        policeCase.ob_number,
        policeCase.resolved_title,
        policeCase.case_type || policeCase.incident_type || 'General',
        policeCase.description || null,
        policeCase.status,
        existing.id,
      ]
    );
    return { ...existing, alreadyExists: true };
  }

  const courtCaseNumber = await generateCourtCaseNumber();
  const [result] = await db.query(
    `INSERT INTO court_cases (
       court_case_number, police_case_id, police_case_number, ob_number, case_title,
       crime_category, case_description, source_status, status, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'registered', ?)`,
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

  await db.query(
    `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
     VALUES (?, ?, 'COURT_CASE_CREATED', ?, ?)`,
    [caseId, actor, `Court case ${courtCaseNumber} created automatically.`, policeCase.status]
  );

  return { id: result.insertId, court_case_number: courtCaseNumber, alreadyExists: false };
};

module.exports = { COURT_READY_STATUSES, isCourtReadyStatus, ensureCourtCaseForPoliceCase };
