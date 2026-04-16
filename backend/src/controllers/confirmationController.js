// src/controllers/confirmationController.js
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { saveBlockchainRecord } = require('../utils/hashUtil');

/** POST /api/confirmations/submit — Officer submits draft for review */
const submitForReview = async (req, res, next) => {
  try {
    const { case_id, comments } = req.body;
    if (!case_id) return res.status(400).json({ success: false, message: 'case_id is required.' });

    const [[existing]] = await db.query('SELECT status, created_by, assigned_officer_id FROM cases WHERE id = ?', [case_id]);
    if (!existing) return res.status(404).json({ success: false, message: 'Case not found.' });
    
    if (existing.status !== 'DRAFT' && existing.status !== 'RETURNED_FOR_CORRECTION') {
      return res.status(400).json({ success: false, message: 'Case is not in draft or returned state.' });
    }

    if (req.user.role !== 'admin' && existing.created_by !== req.user.username) {
       return res.status(403).json({ success: false, message: 'You are not authorized to submit this case.' });
    }

    await db.query(`UPDATE cases SET status = 'PENDING_COMMANDER_REVIEW' WHERE id = ?`, [case_id]);
    
    await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after) VALUES (?, ?, ?, ?, ?, ?)`,
      [case_id, req.user.username, 'SUBMITTED_FOR_REVIEW', comments || 'Case submitted for Commander review.', existing.status, 'PENDING_COMMANDER_REVIEW']);

    await writeAuditLog({ userId: req.user.username, userEmail: req.user.email, action: 'SUBMIT_FOR_REVIEW', entityType: 'cases', entityId: parseInt(case_id) });

    res.json({ success: true, message: 'Case submitted for review.' });
  } catch (err) { next(err); }
};

/** POST /api/confirmations/respond — Commander confirms, returns, or rejects */
const respondToConfirmation = async (req, res, next) => {
  try {
    const { case_id, status, comments } = req.body;
    // status can be: confirmed, returned, rejected
    if (!case_id || !status) return res.status(400).json({ success: false, message: 'case_id and status are required.' });

    const [[caseRow]] = await db.query(
      `SELECT c.* FROM cases c WHERE c.id = ?`, [case_id]
    );
    if (!caseRow) return res.status(404).json({ success: false, message: 'Case not found.' });

    if (caseRow.status !== 'PENDING_COMMANDER_REVIEW') {
      return res.status(400).json({ success: false, message: 'Case is not pending review.' });
    }

    let nextStatus;
    let actionType;
    if (status === 'confirmed') {
      nextStatus = 'CONFIRMED_BY_COMMANDER';
      actionType = 'CONFIRMED_BY_COMMANDER';
    } else if (status === 'returned') {
      nextStatus = 'RETURNED_FOR_CORRECTION';
      actionType = 'RETURNED_BY_COMMANDER';
    } else if (status === 'rejected') {
      nextStatus = 'REJECTED';
      actionType = 'REJECTED_BY_COMMANDER';
    } else {
      return res.status(400).json({ success: false, message: 'Invalid confirmation status.' });
    }

    await db.query(`UPDATE cases SET status = ? WHERE id = ?`, [nextStatus, case_id]);

    await db.query(
      `INSERT INTO case_confirmations (case_id, confirmation_status, comments, confirmed_at, confirmed_by_username)
       VALUES (?, ?, ?, ?, ?)`,
      [case_id, status, comments || null, status === 'confirmed' ? new Date() : null, req.user.username]
    );

    await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after) VALUES (?, ?, ?, ?, ?, ?)`,
      [case_id, req.user.username, actionType, comments || `Case ${status} by Commander.`, 'PENDING_COMMANDER_REVIEW', nextStatus]);

    // BLOCKCHAIN TRIGGER: ONLY UPON CONFIRMATION
    if (status === 'confirmed') {
      const snapshot = { 
        ob_number: caseRow.ob_number, 
        title: caseRow.title, 
        description: caseRow.description, 
        incident_date: caseRow.incident_date, 
        incident_location: caseRow.incident_location, 
        priority: caseRow.priority 
      };
      await saveBlockchainRecord('case', case_id, snapshot, req.user.username);
      console.log(`Generated blockchain proof for confirmed case ${caseRow.ob_number}`);
    }

    await writeAuditLog({ userId: req.user.username, userEmail: req.user.email, action: actionType, entityType: 'cases', entityId: parseInt(case_id) });

    res.json({ success: true, message: `Case ${status} successfully.` });
  } catch (err) { next(err); }
};

module.exports = { submitForReview, respondToConfirmation };
