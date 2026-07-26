'use strict';

const db = require('../config/database');

const TERMINAL_POLICE_STATUSES = new Set(['court_decided', 'closed', 'archived']);
const TERMINAL_COURT_STATUSES = new Set(['closed', 'archived']);
const CID_WORKFLOW = [
  'open',
  'under_investigation',
  'evidence_collection',
  'witness_interviews',
  'suspect_tracking',
  'arrest_made',
  'investigation_completed',
  'supervisor_review',
  'approved',
];

class WorkflowError extends Error {
  constructor(message, statusCode = 409, code = 'WORKFLOW_CONFLICT') {
    super(message);
    this.name = 'WorkflowError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const POLICE_TRANSITIONS = {
  draft: ['registered'],
  registered: ['referred_to_cid', 'under_investigation'],
  CASE_REGISTERED: ['referred_to_cid', 'under_investigation'],
  pending_commander_review: ['registered'],
  referred_to_cid: ['under_investigation'],
  under_investigation: ['referred_to_cid', 'ready_for_court', 'approved_for_court'],
  ready_for_court: ['approved_for_court'],
  forwarded_to_court: ['approved_for_court', 'court_decided'],
  approved_for_court: ['court_decided'],
  court_decided: ['closed'],
  closed: ['archived'],
  archived: [],
};

const assertPoliceTransition = (from, to, { authorizedReopen = false } = {}) => {
  if (!to || from === to) return true;
  if (TERMINAL_POLICE_STATUSES.has(from) && authorizedReopen &&
      ['referred_to_cid', 'under_investigation', 'approved_for_court'].includes(to)) return true;
  if (!(POLICE_TRANSITIONS[from] || []).includes(to)) {
    throw new WorkflowError(`Invalid police case status transition from ${from} to ${to}.`);
  }
  return true;
};

const assertCidTransition = (from, to, { supervisor = false } = {}) => {
  if (!to || from === to) return true;
  if (to === 'rejected' && supervisor && from === 'supervisor_review') return true;
  const fromIndex = CID_WORKFLOW.indexOf(from);
  const toIndex = CID_WORKFLOW.indexOf(to);
  if (fromIndex < 0 || toIndex < 0 || toIndex !== fromIndex + 1) {
    throw new WorkflowError(
      `Invalid CID investigation transition from ${from} to ${to}. Complete each stage in order.`,
      409,
      'INVALID_CID_TRANSITION'
    );
  }
  if (to === 'approved' && !supervisor) {
    throw new WorkflowError(
      'Only a supervisor can approve the investigation.',
      403,
      'CID_SUPERVISOR_REQUIRED'
    );
  }
  return true;
};

const validateSentence = ({ sentence_type, duration, fine_amount }) => {
  const type = String(sentence_type || '').toLowerCase();
  if (!['imprisonment', 'fine', 'both'].includes(type)) {
    throw new WorkflowError('sentence_type must be imprisonment, fine, or both.', 400, 'INVALID_SENTENCE');
  }
  if (['imprisonment', 'both'].includes(type)) {
    const durStr = String(duration || '').trim();
    if (!durStr) {
      throw new WorkflowError('Imprisonment requires a prison duration.', 400, 'INVALID_SENTENCE');
    }
    const match = durStr.match(/^(\d+)\s*(sano|bilood|cisho|years?|months?|days?)$/i);
    if (!match || Number(match[1]) <= 0) {
      throw new WorkflowError('Duration must specify a valid positive number and unit (e.g., "2 sano", "6 bilood", "10 days"). Plain unvalidated text is not allowed.', 400, 'INVALID_SENTENCE');
    }
  }
  if (['fine', 'both'].includes(type) && !(Number(fine_amount) > 0)) {
    throw new WorkflowError('A fine requires a positive fine amount.', 400, 'INVALID_SENTENCE');
  }
  if (type === 'imprisonment' && Number(fine_amount) > 0) {
    throw new WorkflowError('Use sentence_type "both" when imprisonment and a fine both apply.', 400, 'INVALID_SENTENCE');
  }
  if (type === 'fine' && String(duration || '').trim()) {
    throw new WorkflowError('Use sentence_type "both" when a fine and imprisonment both apply.', 400, 'INVALID_SENTENCE');
  }
  return true;
};

const validateJudgmentSentenceConsistency = (summary, sentence) => {
  const text = String(summary || '').toLowerCase();
  const mentionsPrison = /\b(imprison\w*|prison|jail|custody)\b|xabsi|la xiro/.test(text);
  const mentionsFine = /\bfine\b|ganaax/.test(text);
  if (mentionsPrison && sentence.sentence_type === 'fine') {
    throw new WorkflowError('Judgment summary mentions imprisonment but the structured sentence is fine-only.', 400, 'SENTENCE_CONTRADICTION');
  }
  if (mentionsFine && sentence.sentence_type === 'imprisonment') {
    throw new WorkflowError('Judgment summary mentions a fine but the structured sentence is imprisonment-only.', 400, 'SENTENCE_CONTRADICTION');
  }
  return true;
};

const withTransaction = async (work, pool = db.pool) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const mapObComplainant = (ob, policeCase = {}) => ({
  complainant_name: policeCase.complainant_name || ob?.reported_by || null,
  complainant_phone: policeCase.complainant_phone || ob?.reporter_phone || null,
});

const validateCourtDates = ({ hearingDate, judgmentDate, closureDate, hearingStatus = 'scheduled' }) => {
  if (closureDate && hearingDate && hearingDate > closureDate && hearingStatus !== 'cancelled') {
    throw new WorkflowError('Hearing date cannot be after closure unless the hearing is cancelled.', 400, 'INVALID_COURT_DATE');
  }
  if (closureDate && judgmentDate && judgmentDate > closureDate) {
    throw new WorkflowError('Judgment decision date cannot be after closure date.', 400, 'INVALID_COURT_DATE');
  }
  return true;
};

const hasReopenAuthorization = async (connection, policeCaseId) => {
  const [[appeal]] = await connection.query(
    `SELECT ca.id
       FROM court_appeals ca
       JOIN court_cases cc ON cc.id = ca.court_case_id
      WHERE cc.police_case_id = ? AND ca.status = 'approved'
      LIMIT 1`,
    [policeCaseId]
  );
  if (appeal) return true;
  const [[authorization]] = await connection.query(
    `SELECT id FROM case_workflow_authorizations
      WHERE case_id = ? AND authorization_type = 'reopen_case'
        AND status = 'approved' AND (expires_at IS NULL OR expires_at > NOW())
      LIMIT 1`,
    [policeCaseId]
  );
  return Boolean(authorization);
};

const lockAndAssertReferralAllowed = async (connection, policeCaseId, targetRole) => {
  const [[policeCase]] = await connection.query(
    'SELECT id, status FROM cases WHERE id = ? FOR UPDATE',
    [policeCaseId]
  );
  if (!policeCase) throw new WorkflowError('Police case not found.', 404, 'CASE_NOT_FOUND');

  const [[closedCourt]] = await connection.query(
    `SELECT id, status FROM court_cases
      WHERE police_case_id = ? AND status IN ('closed','archived')
      LIMIT 1 FOR UPDATE`,
    [policeCaseId]
  );
  const terminal = TERMINAL_POLICE_STATUSES.has(policeCase.status) || Boolean(closedCourt);
  if (terminal && !(await hasReopenAuthorization(connection, policeCaseId))) {
    throw new WorkflowError(
      `A terminal case cannot be referred to ${targetRole} without an approved appeal or reopen authorization.`,
      409,
      'TERMINAL_CASE_REFERRAL'
    );
  }

  const [[activeDuplicate]] = await connection.query(
    `SELECT id FROM referrals
      WHERE case_id = ? AND referred_to_role = ? AND status IN ('pending','accepted')
      LIMIT 1 FOR UPDATE`,
    [policeCaseId, targetRole]
  );
  if (activeDuplicate) {
    throw new WorkflowError(`An active ${targetRole} referral already exists.`, 409, 'DUPLICATE_REFERRAL');
  }
  return policeCase;
};

const closeCourtWorkflow = async (connection, {
  courtCaseId,
  closureReason,
  finalOutcome,
  archive = false,
  actor = 'system',
}) => {
  const [[courtCase]] = await connection.query(
    'SELECT * FROM court_cases WHERE id = ? FOR UPDATE',
    [courtCaseId]
  );
  if (!courtCase) throw new WorkflowError('Court case not found.', 404, 'COURT_CASE_NOT_FOUND');

  const [[judgment]] = await connection.query(
    'SELECT * FROM court_judgments WHERE court_case_id = ? ORDER BY decision_date DESC, id DESC LIMIT 1 FOR UPDATE',
    [courtCaseId]
  );
  if (!judgment) throw new WorkflowError('A Court Case cannot be closed before judgment.', 409, 'JUDGMENT_REQUIRED');

  const outcome = finalOutcome || judgment.decision_type || courtCase.final_outcome;
  if (!outcome) throw new WorkflowError('A final court outcome is required.', 400, 'OUTCOME_REQUIRED');
  const closureDate = new Date().toISOString().slice(0, 10);
  if (String(judgment.decision_date).slice(0, 10) > closureDate) {
    throw new WorkflowError('Judgment decision date cannot be after the closure date.', 409, 'INVALID_COURT_DATE');
  }

  await connection.query(
    `UPDATE court_hearings
        SET status = CASE WHEN hearing_date <= ? THEN 'completed' ELSE 'cancelled' END
      WHERE court_case_id = ? AND status = 'scheduled'`,
    [closureDate, courtCaseId]
  );
  await connection.query(
    `UPDATE court_cases SET status = ?, closure_date = ?, closure_reason = COALESCE(?, closure_reason),
       final_outcome = ? WHERE id = ?`,
    [archive ? 'archived' : 'closed', closureDate, closureReason || null, outcome, courtCaseId]
  );
  await connection.query("UPDATE cases SET status = 'court_decided' WHERE id = ?", [courtCase.police_case_id]);
  await connection.query(
    `UPDATE cid_cases SET investigation_status = 'sent_to_court', updated_at = NOW()
      WHERE police_case_id = ? AND investigation_status NOT IN ('sent_to_court')`,
    [courtCase.police_case_id]
  );
  await connection.query(
    `UPDATE referrals SET status = 'completed', responded_at = COALESCE(responded_at, NOW())
      WHERE case_id = ? AND referred_to_role = 'court' AND status IN ('pending','accepted')`,
    [courtCase.police_case_id]
  );
  await connection.query(
    `UPDATE referrals SET status = 'rejected',
       response = COALESCE(response, 'Rejected automatically because the linked court case is closed.'),
       responded_at = COALESCE(responded_at, NOW())
      WHERE case_id = ? AND referred_to_role = 'cid' AND status IN ('pending','accepted')`,
    [courtCase.police_case_id]
  );

  const sentenceStatus = outcome === 'convicted' ? 'sentenced' : outcome;
  await connection.query(
    `UPDATE arrests SET court_decision = ?, sentence_status = ?,
       charges = CASE WHEN ? = 'convicted' AND LOWER(COALESCE(charges,'')) IN ('','not charged','not_charged')
                      THEN 'convicted by court' ELSE charges END,
       final_status = ?
      WHERE case_id = ?`,
    [outcome, sentenceStatus, outcome, outcome, courtCase.police_case_id]
  );
  await connection.query(
    `INSERT INTO case_actions
       (case_id, performed_by, action_type, description, status_before, status_after)
     VALUES (?, ?, 'COURT_CASE_CLOSED', ?, ?, 'court_decided')`,
    [courtCase.police_case_id, actor, closureReason || 'Court case closed.', courtCase.status]
  );
  return { policeCaseId: courtCase.police_case_id, outcome, closureDate };
};

module.exports = {
  WorkflowError,
  POLICE_TRANSITIONS,
  TERMINAL_POLICE_STATUSES,
  TERMINAL_COURT_STATUSES,
  assertPoliceTransition,
  assertCidTransition,
  CID_WORKFLOW,
  validateSentence,
  validateJudgmentSentenceConsistency,
  withTransaction,
  mapObComplainant,
  validateCourtDates,
  hasReopenAuthorization,
  lockAndAssertReferralAllowed,
  closeCourtWorkflow,
};
