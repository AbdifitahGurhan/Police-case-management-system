// src/controllers/blockchainController.js — Hash verification endpoint
'use strict';

const db = require('../config/database');
const { verifyHash } = require('../utils/hashUtil');
const { writeAuditLog } = require('../utils/auditLogger');

/** GET /api/blockchain/records?entity_type=&entity_id= */
const getBlockchainRecords = async (req, res, next) => {
  try {
    const { entity_type, entity_id, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = '1=1';
    const params = [];
    if (entity_type) { where += ' AND br.entity_type = ?'; params.push(entity_type); }
    if (entity_id) { where += ' AND br.entity_id = ?'; params.push(entity_id); }

    const [rows] = await db.query(
      `SELECT br.*, u.full_name AS created_by_name FROM blockchain_records br
       LEFT JOIN users u ON br.created_by = u.username OR br.created_by = CAST(u.id AS CHAR)
       WHERE ${where} ORDER BY br.created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** POST /api/blockchain/verify — Verify integrity of a record */
const verifyRecord = async (req, res, next) => {
  try {
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id) {
      return res.status(400).json({ success: false, message: 'entity_type and entity_id are required.' });
    }

    // Fetch current data from the appropriate table
    let currentData = null;
    if (entity_type === 'case') {
      const [[row]] = await db.query('SELECT id, ob_number, title, description, incident_date, incident_location, case_type, priority FROM cases WHERE id = ?', [entity_id]);
      currentData = row;
    } else if (entity_type === 'evidence') {
      const [[row]] = await db.query('SELECT case_id, title, description, type, collection_date, file_url, evidence_number FROM evidence WHERE id = ?', [entity_id]);
      currentData = row;
    } else if (entity_type === 'witness_statement') {
      const [[row]] = await db.query(
        `SELECT ws.case_id, w.full_name AS witness, ws.statement, ws.statement_date
         FROM witness_statements ws JOIN witnesses w ON ws.witness_id = w.id WHERE ws.id = ?`, [entity_id]);
      currentData = row;
    }

    if (!currentData) {
      return res.status(404).json({ success: false, message: 'Entity not found.' });
    }

    const result = await verifyHash(entity_type, entity_id, currentData);
    
    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'BLOCKCHAIN_VERIFY',
      entityType: entity_type,
      entityId: entity_id,
      newData: { status: result.status }
    });
    
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

module.exports = { getBlockchainRecords, verifyRecord };
