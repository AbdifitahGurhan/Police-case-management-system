// src/controllers/witnessController.js
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { saveBlockchainRecord } = require('../utils/hashUtil');

const getWitnesses = async (req, res, next) => {
  try {
    const { case_id } = req.query;
    if (!case_id) {
      const [rows] = await db.query('SELECT * FROM witnesses ORDER BY full_name ASC');
      return res.json({ success: true, data: rows });
    }
    const [rows] = await db.query(
      `SELECT w.*, ws.id AS statement_id, ws.statement, ws.statement_date
       FROM witnesses w
       JOIN witness_statements ws ON w.id = ws.witness_id
       WHERE ws.case_id = ? ORDER BY ws.statement_date DESC`, [case_id]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const createWitnessAndStatement = async (req, res, next) => {
  try {
    const { case_id, full_name, gender, age, phone, address, relationship_to_case, statement, statement_date } = req.body;
    if (!full_name || !case_id || !statement) {
      return res.status(400).json({ success: false, message: 'case_id, full_name, and statement are required.' });
    }

    const [wResult] = await db.query(
      `INSERT INTO witnesses (full_name, gender, age, phone, address, relationship_to_case) VALUES (?, ?, ?, ?, ?, ?)`,
      [full_name, gender || 'male', age || null, phone || null, address || null, relationship_to_case || null]
    );
    const witnessId = wResult.insertId;

    const [stResult] = await db.query(
      `INSERT INTO witness_statements (case_id, witness_id, statement, statement_date, taken_by) VALUES (?, ?, ?, ?, ?)`,
      [case_id, witnessId, statement, statement_date || null, req.user.id]
    );
    const statementId = stResult.insertId;

    // Blockchain proof for witness statement
    const snapshot = { case_id, witness: full_name, statement, statement_date };
    await saveBlockchainRecord('witness_statement', statementId, snapshot, req.user.id);

    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'ADD_WITNESS', entityType: 'witnesses', entityId: witnessId });
    res.status(201).json({ success: true, message: 'Witness and statement recorded.', witnessId, statementId });
  } catch (err) { next(err); }
};

module.exports = { getWitnesses, createWitnessAndStatement };
