'use strict';

const dateOnly = (value) => {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const normalized = `${match[1]}-${match[2]}-${match[3]}`;
  const date = new Date(`${normalized}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized ? null : normalized;
};

const today = () => new Date().toISOString().slice(0, 10);
const after = (left, right) => left && right && left > right;
const before = (left, right) => left && right && left < right;

function validateObDates({ incidentDate, registrationDate }) {
  const incident = dateOnly(incidentDate);
  const registration = dateOnly(registrationDate) || today();
  if (incidentDate && !incident) return 'Incident date is invalid.';
  if (registrationDate && !dateOnly(registrationDate)) return 'OB registration date is invalid.';
  if (after(incident, today())) return 'Incident date cannot be in the future.';
  if (after(registration, today())) return 'OB registration date cannot be in the future.';
  if (after(incident, registration)) return 'Incident date cannot be later than the OB registration date.';
  return null;
}

function validateWarrantDates({ issueDate, expiryDate, executionDate }) {
  const issue = dateOnly(issueDate);
  const expiry = dateOnly(expiryDate);
  const execution = dateOnly(executionDate);
  if (!issue || !expiry) return 'Issue date and expiry date must be valid dates.';
  if (after(issue, today())) return 'Issue date cannot be in the future.';
  if (!after(expiry, issue)) return 'Expiry date must be later than the warrant issue date.';
  if (executionDate && !execution) return 'Execution date is invalid.';
  if (before(execution, issue)) return 'Execution date cannot be before the warrant issue date.';
  if (after(execution, expiry)) return 'Execution date cannot be later than the warrant expiry date.';
  return null;
}

function validateCourtDates({ submissionDate, obRegistrationDate, investigationStartDate, hearingDate, judgmentDate, closedDate }) {
  const submission = dateOnly(submissionDate);
  const earliest = [dateOnly(obRegistrationDate), dateOnly(investigationStartDate)].filter(Boolean).sort().pop();
  const hearing = dateOnly(hearingDate);
  const judgment = dateOnly(judgmentDate);
  const closed = dateOnly(closedDate);
  if (before(submission, earliest)) return 'Court submission date cannot be before the OB registration or investigation start date.';
  if (before(hearing, submission)) return 'Hearing date cannot be before the court submission date.';
  if (before(judgment, hearing)) return 'Judgment date cannot be before the hearing date.';
  if (before(closed, judgment)) return 'Closed date cannot be before the judgment date.';
  return null;
}

module.exports = { dateOnly, today, validateObDates, validateWarrantDates, validateCourtDates };
