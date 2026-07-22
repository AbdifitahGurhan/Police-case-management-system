'use strict';

const { withTransaction, WorkflowError, validateSentence } = require('./caseWorkflowService');

const repairClosedCaseByObNumber = async ({
  obNumber,
  administrator,
  criminalId,
  sentenceType,
  duration = null,
  fineAmount = null,
  judgmentDate = null,
  closureDate = null,
  hearingResolution = 'completed',
}) => {
  if (!obNumber || !administrator || !criminalId || !sentenceType) {
    throw new WorkflowError(
      'obNumber, administrator, criminalId, and sentenceType are required administrator verifications.',
      400,
      'REPAIR_VERIFICATION_REQUIRED'
    );
  }
  if (!['completed', 'cancelled'].includes(hearingResolution)) {
    throw new WorkflowError('hearingResolution must be completed or cancelled.', 400);
  }
  validateSentence({ sentence_type: sentenceType, duration, fine_amount: fineAmount });

  return withTransaction(async (connection) => {
    const [[policeCase]] = await connection.query(
      `SELECT c.*, ob.reported_by, ob.reporter_phone
         FROM cases c JOIN ob_entries ob ON ob.id = c.ob_entry_id
        WHERE c.ob_number = ? FOR UPDATE`,
      [obNumber]
    );
    if (!policeCase) throw new WorkflowError('OB-linked Police Case not found.', 404);

    const [[courtCase]] = await connection.query(
      `SELECT * FROM court_cases
        WHERE police_case_id = ? AND status IN ('closed','archived')
        ORDER BY closure_date DESC, id DESC LIMIT 1 FOR UPDATE`,
      [policeCase.id]
    );
    if (!courtCase) throw new WorkflowError('A verified closed Court Case is required for repair.', 409);

    const [[criminal]] = await connection.query(
      `SELECT cr.id, cr.full_name
         FROM case_criminals link JOIN criminals cr ON cr.id = link.criminal_id
        WHERE link.case_id = ? AND link.criminal_id = ? AND link.status = 'active'
        FOR UPDATE`,
      [policeCase.id, criminalId]
    );
    if (!criminal) throw new WorkflowError('Verified defendant is not linked to this Police Case.', 400);

    const effectiveClosureDate = closureDate || String(courtCase.closure_date).slice(0, 10);
    const [[judgment]] = await connection.query(
      'SELECT * FROM court_judgments WHERE court_case_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [courtCase.id]
    );
    if (!judgment) throw new WorkflowError('Verified closed Court Case has no judgment.', 409);
    const effectiveJudgmentDate = judgmentDate || String(judgment.decision_date).slice(0, 10);
    if (effectiveJudgmentDate > effectiveClosureDate) {
      throw new WorkflowError('Verified judgment date cannot be after closure date.', 400);
    }

    await connection.query(
      `UPDATE cases SET status = 'court_decided',
         complainant_name = COALESCE(NULLIF(complainant_name, ''), ?),
         complainant_phone = COALESCE(NULLIF(complainant_phone, ''), ?)
       WHERE id = ?`,
      [policeCase.reported_by, policeCase.reporter_phone, policeCase.id]
    );
    await connection.query(
      `UPDATE cid_cases SET investigation_status = 'sent_to_court', updated_at = NOW()
        WHERE police_case_id = ?`,
      [policeCase.id]
    );
    await connection.query(
      `UPDATE referrals SET status = 'completed', responded_at = COALESCE(responded_at, NOW())
        WHERE id = (
          SELECT id FROM (
            SELECT id FROM referrals WHERE case_id = ? AND referred_to_role = 'court'
            ORDER BY referred_at ASC LIMIT 1
          ) original_referral
        )`,
      [policeCase.id]
    );
    await connection.query(
      `UPDATE referrals SET status = 'rejected',
         response = 'Rejected by administrator repair: referral occurred after verified Court closure.',
         responded_at = COALESCE(responded_at, NOW())
       WHERE case_id = ? AND referred_at > ? AND status IN ('pending','accepted')`,
      [policeCase.id, `${effectiveClosureDate} 23:59:59`]
    );
    await connection.query(
      `UPDATE court_hearings SET status = ?
        WHERE court_case_id = ? AND status = 'scheduled'`,
      [hearingResolution, courtCase.id]
    );
    await connection.query(
      'UPDATE court_judgments SET decision_date = ? WHERE id = ?',
      [effectiveJudgmentDate, judgment.id]
    );
    await connection.query(
      'UPDATE court_cases SET closure_date = ?, status = ? WHERE id = ?',
      [effectiveClosureDate, courtCase.status, courtCase.id]
    );

    const [[sentence]] = await connection.query(
      'SELECT id FROM court_sentences WHERE court_case_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [courtCase.id]
    );
    if (sentence) {
      await connection.query(
        `UPDATE court_sentences SET criminal_id = ?, sentence_type = ?, duration = ?, fine_amount = ?,
           sentence_date = LEAST(sentence_date, ?) WHERE id = ?`,
        [criminalId, sentenceType, duration, fineAmount, effectiveClosureDate, sentence.id]
      );
    }
    const sentenceStatus = courtCase.final_outcome === 'convicted' ? 'sentenced' : courtCase.final_outcome;
    await connection.query(
      `UPDATE arrests SET court_decision = ?, sentence_status = ?,
         charges = CASE WHEN ? = 'convicted' AND LOWER(COALESCE(charges,'')) IN ('','not charged','not_charged')
                        THEN 'convicted by court' ELSE charges END,
         final_status = ?
       WHERE case_id = ?`,
      [courtCase.final_outcome, sentenceStatus, courtCase.final_outcome, courtCase.final_outcome, policeCase.id]
    );
    await connection.query(
      `INSERT INTO case_actions
        (case_id, performed_by, action_type, description, status_before, status_after)
       VALUES (?, ?, 'ADMIN_WORKFLOW_REPAIR', ?, ?, 'court_decided')`,
      [policeCase.id, administrator, `Administrator-verified repair for ${obNumber}.`, policeCase.status]
    );
    return {
      obNumber,
      policeCaseId: policeCase.id,
      courtCaseId: courtCase.id,
      criminalId,
      defendantName: criminal.full_name,
      repairedBy: administrator,
    };
  });
};

module.exports = { repairClosedCaseByObNumber };
