'use strict';

const db = require('../config/database');

const CID_READY_STATUSES = ['referred_to_cid', 'referred_cid', 'assigned_to_cid'];

const isCidReadyStatus = (status) => CID_READY_STATUSES.includes(String(status || '').toLowerCase());

const ensureCidCaseForPoliceCase = async (caseId, createdBy = 'system', executor = db, options = {}) => {
  const forceCreate = Boolean(options.force);
  const [[policeCase]] = await executor.query(
    `SELECT c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
            COALESCE(c.case_type, c.incident_type) AS crime_category,
            c.priority, c.status, c.assigned_officer_id, po.full_name AS assigned_officer_name
     FROM cases c
     LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
     WHERE c.id = ?`,
    [caseId]
  );
  if (!policeCase) return null;

  const [[referral]] = await executor.query(
    "SELECT id, status FROM referrals WHERE case_id = ? AND referred_to_role IN ('cid','investigator') LIMIT 1",
    [caseId]
  );

  const isCidReady = isCidReadyStatus(policeCase.status) || (referral && ['accepted', 'pending', 'completed'].includes(referral.status));
  const [courtCidRemands] = await executor.query(
    "SELECT id FROM court_remands WHERE police_case_id = ? AND LOWER(sent_to_role) = 'cid' LIMIT 1",
    [caseId]
  );
  const hasCourtCidRemand = forceCreate || courtCidRemands.length > 0;
  if (!isCidReady && !hasCourtCidRemand) return null;

  const [[existing]] = await executor.query('SELECT * FROM cid_cases WHERE police_case_id = ?', [caseId]);
  if (existing) {
    if (['sent_to_court'].includes(existing.investigation_status) && !hasCourtCidRemand) {
      return { ...existing, alreadyExists: true, terminal: true };
    }
    await executor.query(
      `UPDATE cid_cases
       SET case_number = ?, case_title = ?, crime_category = ?, priority = ?,
           assigned_officer = COALESCE(assigned_officer, ?),
           assignment_status = CASE WHEN ? THEN 'assigned' ELSE assignment_status END,
           investigation_status = CASE WHEN ? THEN 'under_investigation' ELSE investigation_status END,
           updated_at = NOW()
       WHERE id = ?`,
      [
        policeCase.case_number,
        policeCase.title,
        policeCase.crime_category || 'General',
        policeCase.priority || 'medium',
        policeCase.assigned_officer_name || null,
        hasCourtCidRemand,
        hasCourtCidRemand,
        existing.id,
      ]
    );
    return { ...existing, alreadyExists: true };
  }

  const supervisor = createdBy || 'system';
  const initialInvestigationStatus = hasCourtCidRemand ? 'under_investigation' : 'open';
  const [result] = await executor.query(
    `INSERT INTO cid_cases
       (police_case_id, case_number, ob_number, case_title, crime_category, priority,
        assigned_officer, supervisor, assignment_status, investigation_status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?)`,
    [
      policeCase.id,
      policeCase.case_number,
      policeCase.ob_number,
      policeCase.title,
      policeCase.crime_category || 'General',
      policeCase.priority || 'medium',
      policeCase.assigned_officer_name || null,
      supervisor,
      initialInvestigationStatus,
      createdBy,
    ]
  );

  await executor.query(
    `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
     VALUES (?, ?, 'CID_CASE_CREATED', 'Case added to CID investigation dashboard.', ?)`,
    [caseId, createdBy, policeCase.status]
  );

  const [[created]] = await executor.query('SELECT * FROM cid_cases WHERE id = ?', [result.insertId]);
  return created;
};

const syncAllCidCases = async (createdBy = 'system') => {
  try {
    const [eligibleCases] = await db.query(`
      SELECT DISTINCT c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
             COALESCE(c.case_type, c.incident_type) AS crime_category,
             c.priority, c.status AS case_status, po.full_name AS assigned_officer_name,
             cr.sent_by AS referral_by
      FROM cases c
      LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
      JOIN court_remands cr ON cr.police_case_id = c.id AND LOWER(cr.sent_to_role) = 'cid'
    `);

    let syncCount = 0;
    for (const pc of eligibleCases) {
      const [[existing]] = await db.query('SELECT id FROM cid_cases WHERE police_case_id = ?', [pc.id]);
      if (!existing) {
        let investigation_status = 'open';
        let assignment_status = 'assigned';

        if (['court_decided', 'closed', 'archived'].includes(pc.case_status)) {
          investigation_status = 'sent_to_court';
          assignment_status = 'accepted';
        } else if (pc.case_status === 'approved_for_court') {
          investigation_status = 'approved';
          assignment_status = 'accepted';
        } else if (pc.case_status === 'ready_for_court') {
          investigation_status = 'sent_to_prosecutor';
          assignment_status = 'accepted';
        } else if (pc.case_status === 'under_investigation') {
          investigation_status = 'under_investigation';
          assignment_status = 'accepted';
        }

        const supervisor = pc.referral_by || createdBy || 'system';
        await db.query(
          `INSERT INTO cid_cases
             (police_case_id, case_number, ob_number, case_title, crime_category, priority,
              assigned_officer, supervisor, assignment_status, investigation_status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pc.id,
            pc.case_number,
            pc.ob_number,
            pc.title,
            pc.crime_category || 'General',
            pc.priority || 'medium',
            pc.assigned_officer_name || null,
            supervisor,
            assignment_status,
            investigation_status,
            supervisor,
          ]
        );

        await db.query(
          `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
           VALUES (?, ?, 'CID_CASE_SYNCED', 'Case synchronized to CID investigation dashboard.', ?)`,
          [pc.id, supervisor, pc.case_status]
        );

        syncCount++;
      }
    }
    return syncCount;
  } catch (err) {
    console.error('Error in syncAllCidCases:', err);
    throw err;
  }
};

module.exports = { CID_READY_STATUSES, isCidReadyStatus, ensureCidCaseForPoliceCase, syncAllCidCases };
