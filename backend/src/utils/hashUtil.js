// src/utils/hashUtil.js — SHA-256 hash generation and verification
'use strict';

const crypto = require('crypto');
const db = require('../config/database');

/**
 * Generate a SHA-256 hash of the given data.
 * @param {Object|string} data - Data to hash
 * @returns {string} hex hash
 */
function generateHash(data) {
  const serialized = typeof data === 'string' ? data : JSON.stringify(data, Object.keys(data).sort());
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Save a blockchain proof record for an entity.
 * @param {string} entityType - e.g. 'case', 'evidence'
 * @param {number} entityId
 * @param {Object} dataSnapshot - The data that was hashed
 * @param {number} createdBy - User ID who triggered the action
 * @returns {Promise<string>} The generated hash
 */
async function saveBlockchainRecord(entityType, entityId, dataSnapshot, createdBy) {
  const hash = generateHash(dataSnapshot);
  const [result] = await db.query(
    `INSERT INTO blockchain_records (entity_type, entity_id, hash_sha256, data_snapshot, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [entityType, entityId, hash, JSON.stringify(dataSnapshot), createdBy]
  );
  return result.insertId;
}

/**
 * Verify integrity: re-hash current data and compare to stored hash.
 * @param {string} entityType
 * @param {number} entityId
 * @param {Object} currentData - Current record data from DB
 * @returns {Promise<{valid: boolean, storedHash: string, computedHash: string}>}
 */
async function verifyHash(entityType, entityId, currentData) {
  const [rows] = await db.query(
    `SELECT hash_sha256, data_snapshot FROM blockchain_records 
     WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC LIMIT 1`,
    [entityType, entityId]
  );

  if (!rows.length) {
    return { valid: false, message: 'No blockchain record found for this entity.' };
  }

  const storedHash = rows[0].hash_sha256;
  const computedHash = generateHash(currentData);

  return {
    valid: storedHash === computedHash,
    storedHash,
    computedHash,
    message: storedHash === computedHash
      ? 'Integrity verified. Record has not been tampered with.'
      : '⚠️ TAMPERED! The record does not match its blockchain proof.',
  };
}

module.exports = { generateHash, saveBlockchainRecord, verifyHash };
