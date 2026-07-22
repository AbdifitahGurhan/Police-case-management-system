'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertPoliceTransition,
  validateSentence,
  validateJudgmentSentenceConsistency,
  validateCourtDates,
  mapObComplainant,
  withTransaction,
  lockAndAssertReferralAllowed,
} = require('../src/services/caseWorkflowService');

test('accepts valid police transitions', () => {
  assert.equal(assertPoliceTransition('registered', 'referred_to_cid'), true);
  assert.equal(assertPoliceTransition('approved_for_court', 'court_decided'), true);
  assert.equal(assertPoliceTransition('court_decided', 'closed'), true);
});

test('rejects terminal and backwards police transitions', () => {
  assert.throws(() => assertPoliceTransition('closed', 'referred_to_cid'), /Invalid police case/);
  assert.throws(() => assertPoliceTransition('closed', 'approved_for_court'), /Invalid police case/);
  assert.throws(() => assertPoliceTransition('court_decided', 'under_investigation'), /Invalid police case/);
});

test('permits a terminal reopen only when explicitly authorized', () => {
  assert.equal(
    assertPoliceTransition('closed', 'under_investigation', { authorizedReopen: true }),
    true
  );
});

test('validates structured sentence components', () => {
  assert.equal(validateSentence({ sentence_type: 'imprisonment', duration: '2 years' }), true);
  assert.equal(validateSentence({ sentence_type: 'fine', fine_amount: 300 }), true);
  assert.equal(validateSentence({ sentence_type: 'both', duration: '2 years', fine_amount: 300 }), true);
  assert.throws(() => validateSentence({ sentence_type: 'imprisonment' }), /duration/);
  assert.throws(() => validateSentence({ sentence_type: 'fine' }), /fine amount/);
  assert.throws(() => validateSentence({ sentence_type: 'fine', duration: '1 year', fine_amount: 20 }), /both/);
});

test('rejects judgment and structured sentence contradictions', () => {
  assert.throws(
    () => validateJudgmentSentenceConsistency('The defendant shall be imprisoned', { sentence_type: 'fine' }),
    /fine-only/
  );
  assert.throws(
    () => validateJudgmentSentenceConsistency('Waxaa lagu xukumay ganaax', { sentence_type: 'imprisonment' }),
    /imprisonment-only/
  );
});

test('validates court chronology', () => {
  assert.throws(
    () => validateCourtDates({ hearingDate: '2026-07-02', closureDate: '2026-07-01' }),
    /Hearing date/
  );
  assert.equal(
    validateCourtDates({ hearingDate: '2026-07-02', closureDate: '2026-07-01', hearingStatus: 'cancelled' }),
    true
  );
  assert.throws(
    () => validateCourtDates({ judgmentDate: '2026-07-02', closureDate: '2026-07-01' }),
    /Judgment decision/
  );
});

test('maps complainant details from OB without overwriting case values', () => {
  assert.deepEqual(
    mapObComplainant({ reported_by: 'Abdi', reporter_phone: '610000000' }),
    { complainant_name: 'Abdi', complainant_phone: '610000000' }
  );
  assert.deepEqual(
    mapObComplainant(
      { reported_by: 'Abdi', reporter_phone: '610000000' },
      { complainant_name: 'Verified Name', complainant_phone: '620000000' }
    ),
    { complainant_name: 'Verified Name', complainant_phone: '620000000' }
  );
});

test('rolls back a transaction when any workflow step fails', async () => {
  const calls = [];
  const connection = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
  };
  const pool = { getConnection: async () => connection };
  await assert.rejects(
    withTransaction(async () => {
      calls.push('write-one');
      throw new Error('write-two failed');
    }, pool),
    /write-two failed/
  );
  assert.deepEqual(calls, ['begin', 'write-one', 'rollback', 'release']);
});

test('rejects duplicate active referrals while holding row locks', async () => {
  const responses = [
    [[{ id: 7, status: 'under_investigation' }]],
    [[]],
    [[{ id: 99 }]],
  ];
  const connection = { query: async () => responses.shift() };
  await assert.rejects(
    lockAndAssertReferralAllowed(connection, 7, 'court'),
    (error) => error.code === 'DUPLICATE_REFERRAL'
  );
});

test('rejects closed case referral without appeal or reopen authorization', async () => {
  const responses = [
    [[{ id: 7, status: 'closed' }]],
    [[{ id: 2, status: 'closed' }]],
    [[]],
    [[]],
  ];
  const connection = { query: async () => responses.shift() };
  await assert.rejects(
    lockAndAssertReferralAllowed(connection, 7, 'cid'),
    (error) => error.code === 'TERMINAL_CASE_REFERRAL'
  );
});
