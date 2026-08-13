'use strict';

function resolveInitialCaseAssignment(investigators) {
  const list = Array.isArray(investigators) ? investigators : [];
  if (list.length !== 1) {
    return {
      assignedOfficerId: null,
      status: 'draft',
      autoAssignedInvestigator: null,
    };
  }

  return {
    assignedOfficerId: list[0].id,
    status: 'registered',
    autoAssignedInvestigator: list[0],
  };
}

module.exports = {
  resolveInitialCaseAssignment,
};
