// src/controllers/referralController.js — Case referral workflow
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

/** GET /api/referrals?case_id=X or ?role=cid */
const getReferrals = async (req, res, next) => {
  try {
    const { case_id } = req.query;
    const { role, id: userId } = req.user;
    let where = '1=1';
    const params = [];

    if (case_id) { where += ' AND r.case_id = ?'; params.push(case_id); }
    else if (role === 'cid') { where += ' AND r.referred_to_role = "cid"'; }
    else if (role === 'prosecutor') { where += ' AND r.referred_to_role = "prosecutor"'; }

    const [rows] = await db.query(
      `SELECT r.*, c.ob_number, c.title AS case_title, u.full_name AS referred_by_name
       FROM referrals r
       JOIN cases c ON r.case_id = c.id
       JOIN users u ON r.referred_by = u.id
       WHERE ${where} ORDER BY r.referred_at DESC`, params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** POST /api/referrals — Refer a case to CID or Prosecutor */
const createReferral = async (req, res, next) => {
  try {
    const { case_id, referred_to_role, referred_to_user, reason, notes } = req.body;
    if (!case_id || !referred_to_role) return res.status(400).json({ success: false, message: 'case_id and referred_to_role are required.' });

    if (!['cid', 'prosecutor'].includes(referred_to_role)) {
      return res.status(400).json({ success: false, message: 'referred_to_role must be "cid" or "prosecutor".' });
    }

    const [result] = await db.query(
      `INSERT INTO referrals (case_id, referred_by, referred_to_role, referred_to_user, reason, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [case_id, req.user.id, referred_to_role, referred_to_user || null, reason || null, notes || null]
    );

    // Update case status
    const newStatus = referred_to_role === 'cid' ? 'referred_cid' : 'referred_prosecutor';
    await db.query('UPDATE cases SET status = ? WHERE id = ?', [newStatus, case_id]);

    // Update assigned officer on case
    if (referred_to_role === 'cid' && referred_to_user) {
      await db.query('UPDATE cases SET assigned_cid_id = ? WHERE id = ?', [referred_to_user, case_id]);
    } else if (referred_to_role === 'prosecutor' && referred_to_user) {
      await db.query('UPDATE cases SET assigned_prosecutor_id = ? WHERE id = ?', [referred_to_user, case_id]);
    }

    // Case action log
    await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after) VALUES (?, ?, ?, ?, ?)`,
      [case_id, req.user.id, 'CASE_REFERRED', `Case referred to ${referred_to_role.toUpperCase()}`, newStatus]);

    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_REFERRAL', entityType: 'referrals', entityId: result.insertId });
    res.status(201).json({ success: true, message: `Case referred to ${referred_to_role}.`, referralId: result.insertId });
  } catch (err) { next(err); }
};

/** PUT /api/referrals/:id/respond — CID or Prosecutor responds */
const respondToReferral = async (req, res, next) => {
  try {
    const { status, response } = req.body; // status: accepted|rejected|completed
    if (!['accepted', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be: accepted, rejected, or completed.' });
    }

    const [[ref]] = await db.query('SELECT * FROM referrals WHERE id = ?', [req.params.id]);
    if (!ref) return res.status(404).json({ success: false, message: 'Referral not found.' });

    const resStatus = status; // accepted|rejected|completed
    const resResponse = response || null;

    await db.query('UPDATE referrals SET status = ?, response = ?, responded_at = NOW() WHERE id = ?',
      [resStatus, resResponse, req.params.id]);

    // Handle case status transitions based on response
    let caseStatus = null;
    let actionDescription = `Referral ${resStatus}.`;

    if (resStatus === 'completed') {
      caseStatus = 'closed';
    } else if (resStatus === 'accepted') {
      caseStatus = 'under_investigation';
    }

    // Special handling for Prosecutor specific statuses if status passed is special
    // e.g. status='approved_court'
    if (status === 'approved_court') {
      caseStatus = 'approved_for_court';
      actionDescription = 'Prosecutor approved the case for court.';
    } else if (status === 'more_evidence') {
      caseStatus = 'returned_evidence';
      actionDescription = 'Prosecutor returned case for more evidence.';
    }

    if (caseStatus) {
      await db.query('UPDATE cases SET status = ? WHERE id = ?', [caseStatus, ref.case_id]);
      await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after) VALUES (?, ?, ?, ?, ?)`,
        [ref.case_id, req.user.id, 'CASE_DECISION', actionDescription, caseStatus]);
    }

    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'RESPOND_REFERRAL', entityType: 'referrals', entityId: parseInt(req.params.id), newData: { status, response } });
    res.json({ success: true, message: 'Referral response recorded.' });
  } catch (err) { next(err); }
};

module.exports = { getReferrals, createReferral, respondToReferral };
