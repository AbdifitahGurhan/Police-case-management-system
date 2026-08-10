// src/controllers/referralController.js - Case referral workflow
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { ensureCourtCaseForPoliceCase } = require('../services/courtService');
const {
  withTransaction,
  lockAndAssertReferralAllowed,
} = require('../services/caseWorkflowService');

const actor = (req) => req.user?.username || req.user?.id || 'system';

/** GET /api/referrals?case_id=X or ?role=cid|court */
const getReferrals = async (req, res, next) => {
  try {
    const { case_id, role: queryRole } = req.query;
    const { role } = req.user;
    let where = '1=1';
    const params = [];

    if (case_id) {
      where += ' AND r.case_id = ?';
      params.push(case_id);
    } else if (queryRole) {
      where += ' AND r.referred_to_role = ?';
      params.push(queryRole);
    } else if (role === 'cid') {
      where += ' AND r.referred_to_role = "cid"';
    } else if (role === 'court') {
      where += ' AND r.referred_to_role = "court"';
    }

    const [rows] = await db.query(
      `SELECT r.*, c.ob_number, c.title AS case_title,
              COALESCE(u.full_name, r.referred_by) AS referred_by_name
       FROM referrals r
       JOIN cases c ON r.case_id = c.id
       LEFT JOIN users u ON r.referred_by = CAST(u.id AS CHAR) OR r.referred_by = u.username
       WHERE ${where}
       ORDER BY r.referred_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** POST /api/referrals - Refer a case to court */
const createReferral = async (req, res, next) => {
  try {
    const { case_id, referred_to_role, referred_to_user, reason, notes } = req.body;
    if (!case_id || !referred_to_role) {
      return res.status(400).json({ success: false, message: 'case_id and referred_to_role are required.' });
    }
    if (referred_to_role !== 'court') {
      return res.status(400).json({ success: false, message: 'Baaraha workflow wuxuu oggol yahay in case-ka loo gudbiyo Court oo keliya.' });
    }

    const transactionResult = await withTransaction(async (connection) => {
      const caseRow = await lockAndAssertReferralAllowed(connection, case_id, referred_to_role);
      const [result] = await connection.query(
        `INSERT INTO referrals (case_id, referred_by, referred_to_role, referred_to_user, reason, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [case_id, actor(req), referred_to_role, referred_to_user || null, reason || null, notes || null]
      );

      const newStatus = 'referred_to_court';
      await connection.query('UPDATE cases SET status = ? WHERE id = ?', [newStatus, case_id]);
      await ensureCourtCaseForPoliceCase(case_id, actor(req), connection);
      await connection.query(
        `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          case_id,
          actor(req),
          'CASE_REFERRED_TO_COURT',
          'Police investigation completed and case forwarded to court.',
          caseRow.status,
          newStatus,
        ]
      );
      return { referralId: result.insertId, newStatus };
    });

    await writeAuditLog({
      userId: actor(req),
      userEmail: req.user.email || req.user.username,
      action: 'COURT_REFERRAL',
      entityType: 'referrals',
      entityId: transactionResult.referralId,
      newData: { case_id, referred_to_role, reason: reason || null, notes: notes || null, status: transactionResult.newStatus },
    });

    res.status(201).json({
      success: true,
      message: 'Case referred to court. Police station workflow ends at this stage.',
      referralId: transactionResult.referralId,
      status: transactionResult.newStatus,
    });
  } catch (err) { next(err); }
};

/** PUT /api/referrals/:id/respond - CID responds; court referrals are referral-only */
const respondToReferral = async (req, res, next) => {
  try {
    const { status, response } = req.body;
    if (!['accepted', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be: accepted, rejected, or completed.' });
    }

    const [[ref]] = await db.query('SELECT * FROM referrals WHERE id = ?', [req.params.id]);
    if (!ref) return res.status(404).json({ success: false, message: 'Referral not found.' });
    if (ref.referred_to_role === 'court') {
      return res.status(400).json({ success: false, message: 'Court referrals are record-only. Court outcome is not managed in this system.' });
    }

    await db.query('UPDATE referrals SET status = ?, response = ?, responded_at = NOW() WHERE id = ?',
      [status, response || null, req.params.id]);

    let caseStatus = null;
    if (status === 'completed') caseStatus = 'under_investigation';
    if (status === 'accepted') caseStatus = 'under_investigation';

    if (caseStatus) {
      await db.query('UPDATE cases SET status = ? WHERE id = ?', [caseStatus, ref.case_id]);
      await db.query(
        `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
         VALUES (?, ?, ?, ?, ?)`,
        [ref.case_id, actor(req), 'REFERRAL_RESPONSE', `Referral ${status}.`, caseStatus]
      );
    }

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'RESPOND_REFERRAL', entityType: 'referrals', entityId: parseInt(req.params.id, 10), newData: { status, response } });
    res.json({ success: true, message: 'Referral response recorded.' });
  } catch (err) { next(err); }
};

module.exports = { getReferrals, createReferral, respondToReferral };
