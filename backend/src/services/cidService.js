'use strict';

const db = require('../config/database');

const CID_READY_STATUSES = ['referred_to_cid', 'referred_cid', 'assigned_to_cid'];

const isCidReadyStatus = (status) => CID_READY_STATUSES.includes(String(status || '').toLowerCase());

const ensureCidCaseForPoliceCase = async (caseId, createdBy = 'system') => {
  const [[policeCase]] = await db.query(
    `SELECT c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
            COALESCE(c.case_type, c.incident_type) AS crime_category,
            c.priority, c.status, c.assigned_officer_id, po.full_name AS assigned_officer_name
     FROM cases c
     LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
     WHERE c.id = ?`,
    [caseId]
  );
  if (!policeCase || !isCidReadyStatus(policeCase.status)) return null;

  const [[existing]] = await db.query('SELECT * FROM cid_cases WHERE police_case_id = ?', [caseId]);
  if (existing) {
    await db.query(
      `UPDATE cid_cases
       SET case_number = ?, case_title = ?, crime_category = ?, priority = ?,
           assigned_officer = COALESCE(assigned_officer, ?), updated_at = NOW()
       WHERE id = ?`,
      [
        policeCase.case_number,
        policeCase.title,
        policeCase.crime_category || 'General',
        policeCase.priority || 'medium',
        policeCase.assigned_officer_name || null,
        existing.id,
      ]
    );
    return { ...existing, alreadyExists: true };
  }

  const supervisor = createdBy || 'system';
  const [result] = await db.query(
    `INSERT INTO cid_cases
       (police_case_id, case_number, ob_number, case_title, crime_category, priority,
        assigned_officer, supervisor, assignment_status, investigation_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'assigned', 'open', ?)`,
    [
      policeCase.id,
      policeCase.case_number,
      policeCase.ob_number,
      policeCase.title,
      policeCase.crime_category || 'General',
      policeCase.priority || 'medium',
      policeCase.assigned_officer_name || null,
      supervisor,
      createdBy,
    ]
  );

  await db.query(
    `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
     VALUES (?, ?, 'CID_CASE_CREATED', 'Case added to CID investigation dashboard.', ?)`,
    [caseId, createdBy, policeCase.status]
  );

  const [[created]] = await db.query('SELECT * FROM cid_cases WHERE id = ?', [result.insertId]);
  return created;
};

module.exports = { CID_READY_STATUSES, isCidReadyStatus, ensureCidCaseForPoliceCase };
