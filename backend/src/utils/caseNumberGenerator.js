'use strict';

const db = require('../config/database');

const generateCaseNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `CASE-${year}-`;
  const [[row]] = await db.query(
    `SELECT case_number
     FROM cases
     WHERE case_number LIKE ?
     ORDER BY case_number DESC
     LIMIT 1`,
    [`${prefix}%`]
  );

  const next = row?.case_number
    ? parseInt(row.case_number.replace(prefix, ''), 10) + 1
    : 1;

  return `${prefix}${String(next).padStart(5, '0')}`;
};

module.exports = { generateCaseNumber };
