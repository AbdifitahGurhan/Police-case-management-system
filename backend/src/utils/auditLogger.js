// src/utils/auditLogger.js — Records every state-changing action for audit trails
'use strict';

const db = require('../config/database');

/**
 * Write an audit log entry.
 * @param {Object} options
 * @param {number|null} options.userId
 * @param {string|null} options.userEmail
 * @param {string} options.action - e.g. 'CREATE_CASE', 'UPDATE_STATUS'
 * @param {string} options.entityType - e.g. 'cases', 'evidence'
 * @param {number|null} options.entityId
 * @param {Object|null} options.oldData
 * @param {Object|null} options.newData
 * @param {string|null} options.ipAddress
 * @param {string|null} options.userAgent
 */
async function writeAuditLog({
  userId = null,
  userEmail = null,
  action,
  entityType = null,
  entityId = null,
  oldData = null,
  newData = null,
  ipAddress = null,
  userAgent = null,
}) {
  try {
    await db.query(
      `INSERT INTO audit_logs 
         (user_id, user_email, action, entity_type, entity_id, old_data, new_data, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        userEmail,
        action,
        entityType,
        entityId,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ipAddress,
        userAgent,
      ]
    );
  } catch (err) {
    // Audit log failures should not break the main flow
    console.error('Audit log error:', err.message);
  }
}

module.exports = { writeAuditLog };
