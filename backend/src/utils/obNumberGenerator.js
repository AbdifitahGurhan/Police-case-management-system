// src/utils/obNumberGenerator.js — Generates unique OB (Occurrence Book) numbers
'use strict';

const db = require('../config/database');

/**
 * Generates the next OB number in format: OB-YYYY-NNNNN
 * Checks the database for the latest OB number and increments.
 * @returns {Promise<string>} e.g. "OB-2024-00001"
 */
async function generateOBNumber() {
  const year = new Date().getFullYear();
  const [rows] = await db.query(
    `SELECT ob_number FROM cases WHERE ob_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`OB-${year}-%`]
  );

  let sequence = 1;
  if (rows.length > 0) {
    const lastNum = rows[0].ob_number.split('-')[2];
    sequence = parseInt(lastNum, 10) + 1;
  }

  return `OB-${year}-${String(sequence).padStart(5, '0')}`;
}

module.exports = { generateOBNumber };
