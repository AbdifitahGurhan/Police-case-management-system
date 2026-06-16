// src/controllers/referralController.js - Case referral workflow
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { ensureCourtCaseForPoliceCase } = require('../services/courtService');
const { ensureCidCaseForPoliceCase } = require('../services/cidService');

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

/** POST /api/referrals - Refer a case to CID or record court referral */
const createReferral = async (req, res, next) => {
  try {
    const { case_id, referred_to_role, referred_to_user, reason, notes } = req.body;
    if (!case_id || !referred_to_role) {
      return res.status(400).json({ success: false, message: 'case_id and referred_to_role are required.' });
    }
    if (!['cid', 'court'].includes(referred_to_role)) {
      return res.status(400).json({ success: false, message: 'referred_to_role must be "cid" or "court".' });
    }

    const [[caseRow]] = await db.query('SELECT id, status FROM cases WHERE id = ?', [case_id]);
    if (!caseRow) return res.status(404).json({ success: false, message: 'Case not found.' });

    const [result] = await db.query(
      `INSERT INTO referrals (case_id, referred_by, referred_to_role, referred_to_user, reason, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [case_id, actor(req), referred_to_role, referred_to_user || null, reason || null, notes || null]
    );

    const newStatus = referred_to_role === 'court' ? 'approved_for_court' : 'referred_to_cid';
    await db.query('UPDATE cases SET status = ? WHERE id = ?', [newStatus, case_id]);
    if (referred_to_role === 'court') {
      await ensureCourtCaseForPoliceCase(case_id, actor(req));
    } else {
      await ensureCidCaseForPoliceCase(case_id, actor(req));
    }

    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        case_id,
        actor(req),
        referred_to_role === 'court' ? 'CASE_REFERRED_TO_COURT' : 'CASE_REFERRED',
        referred_to_role === 'court'
          ? 'Police investigation completed and case forwarded to court for further legal action. Police station workflow ends at court referral.'
          : `Case referred to ${referred_to_role.toUpperCase()}`,
        caseRow.status,
        newStatus,
      ]
    );

    await writeAuditLog({
      userId: actor(req),
      userEmail: req.user.email || req.user.username,
      action: referred_to_role === 'court' ? 'COURT_REFERRAL' : 'CREATE_REFERRAL',
      entityType: 'referrals',
      entityId: result.insertId,
      newData: { case_id, referred_to_role, reason: reason || null, notes: notes || null, status: newStatus },
    });

    res.status(201).json({
      success: true,
      message: referred_to_role === 'court'
        ? 'Case referred to court. Police station workflow ends at this stage.'
        : `Case referred to ${referred_to_role}.`,
      referralId: result.insertId,
      status: newStatus,
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
