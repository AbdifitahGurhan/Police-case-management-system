// src/utils/obNumberGenerator.js — Generates unique OB (Occurrence Book) numbers
'use strict';

const db = require('../config/database');

/**
 * Generates the next OB number in format: OB-YYYY-NNNNN
 * Checks OB entries and cases for the latest OB number and increments.
 * @returns {Promise<string>} e.g. "OB-2024-00001"
 */
async function generateOBNumber() {
  const year = new Date().getFullYear();
  const prefix = `OB-${year}-%`;
  const [rows] = await db.query(
    `SELECT MAX(sequence_number) AS max_sequence
     FROM (
       SELECT CAST(SUBSTRING_INDEX(ob_number, '-', -1) AS UNSIGNED) AS sequence_number
       FROM ob_entries
       WHERE ob_number LIKE ?
       UNION ALL
       SELECT CAST(SUBSTRING_INDEX(ob_number, '-', -1) AS UNSIGNED) AS sequence_number
       FROM cases
       WHERE ob_number LIKE ?
     ) numbers`,
    [prefix, prefix]
  );

  const sequence = Number(rows[0]?.max_sequence || 0) + 1;

  return `OB-${year}-${String(sequence).padStart(5, '0')}`;
}

module.exports = { generateOBNumber };
