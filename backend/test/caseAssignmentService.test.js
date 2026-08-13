'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveInitialCaseAssignment } = require('../src/services/caseAssignmentService');

test('leaves a new case waiting when a district has no investigators', () => {
  assert.deepEqual(resolveInitialCaseAssignment([]), {
    assignedOfficerId: null,
    status: 'draft',
    autoAssignedInvestigator: null,
  });
});

test('auto-assigns a new case when a district has exactly one investigator', () => {
  const investigator = { id: 12, full_name: 'Amina Hassan', force_number: 'SPF-2026-00012' };

  assert.deepEqual(resolveInitialCaseAssignment([investigator]), {
    assignedOfficerId: 12,
    status: 'registered',
    autoAssignedInvestigator: investigator,
  });
});

test('leaves a new case waiting when a district has multiple investigators', () => {
  const result = resolveInitialCaseAssignment([
    { id: 12, full_name: 'Amina Hassan' },
    { id: 15, full_name: 'Yusuf Ali' },
  ]);

  assert.deepEqual(result, {
    assignedOfficerId: null,
    status: 'draft',
    autoAssignedInvestigator: null,
  });
});
