'use strict';

const { repairClosedCaseByObNumber } = require('../src/services/legacyWorkflowRepairService');
const { pool } = require('../src/config/database');

async function run() {
  const input = process.argv[2] ? JSON.parse(process.argv[2]) : null;
  if (!input) {
    throw new Error('Provide administrator-verified repair JSON as the first argument.');
  }
  const result = await repairClosedCaseByObNumber(input);
  console.log(JSON.stringify({ success: true, data: result }, null, 2));
}

run()
  .catch((error) => {
    console.error(JSON.stringify({ success: false, message: error.message, code: error.code }, null, 2));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
