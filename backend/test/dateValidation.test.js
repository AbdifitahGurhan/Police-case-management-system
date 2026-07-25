'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {validateObDates,validateWarrantDates,validateCourtDates}=require('../src/utils/dateValidation');

test('incident cannot be after OB registration',()=>assert.equal(validateObDates({incidentDate:'2026-01-11',registrationDate:'2026-01-10'}),'Incident date cannot be later than the OB registration date.'));
test('negative chronology is rejected for warrants',()=>assert.equal(validateWarrantDates({issueDate:'2026-01-10',expiryDate:'2026-01-09'}),'Expiry date must be later than the warrant issue date.'));
test('execution cannot occur after expiry',()=>assert.equal(validateWarrantDates({issueDate:'2026-01-01',expiryDate:'2026-01-10',executionDate:'2026-01-11'}),'Execution date cannot be later than the warrant expiry date.'));
test('hearing cannot be before submission',()=>assert.equal(validateCourtDates({submissionDate:'2026-02-10',hearingDate:'2026-02-09'}),'Hearing date cannot be before the court submission date.'));
