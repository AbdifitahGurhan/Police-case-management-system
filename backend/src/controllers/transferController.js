// src/controllers/transferController.js — Case & Officer transfer logic
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { saveBlockchainRecord } = require('../utils/hashUtil');

/** POST /api/transfers — Perform case or officer transfer */
const transferCase = async (req, res, next) => {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const { 
      case_id, 
      transfer_type, 
      to_region_id, to_district_id, to_ward_id, 
      to_officer_id, 
      reason 
    } = req.body;

    if (!case_id || !transfer_type || !reason) {
      return res.status(400).json({ success: false, message: 'case_id, transfer_type, and reason are required.' });
    }

    const [[caseRow]] = await connection.query('SELECT * FROM cases WHERE id = ?', [case_id]);
    if (!caseRow) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }

    const from_region_id = caseRow.region_id;
    const from_district_id = caseRow.district_id;
    const from_ward_id = caseRow.ward_id;
    const from_officer_id = caseRow.assigned_officer_id || caseRow.officer_id;

    let updateFields = {};
    if (transfer_type === 'location' || transfer_type === 'both') {
      updateFields.region_id = to_region_id || from_region_id;
      updateFields.district_id = to_district_id || from_district_id;
      updateFields.ward_id = to_ward_id || from_ward_id;
      updateFields.status = 'transferred';
    }

    if (transfer_type === 'officer' || transfer_type === 'both') {
      updateFields.assigned_officer_id = to_officer_id;
      if (transfer_type === 'officer') updateFields.status = 'reassigned';
    }

    const fieldNames = Object.keys(updateFields);
    const fieldValues = Object.values(updateFields);

    if (fieldNames.length > 0) {
      const setClause = fieldNames.map(f => `${f} = ?`).join(', ');
      await connection.query(`UPDATE cases SET ${setClause} WHERE id = ?`, [...fieldValues, case_id]);
    }

    // Insert Transfer History
    const [transResult] = await connection.query(
      `INSERT INTO case_transfers (
        case_id, from_region_id, from_district_id, from_ward_id, 
        to_region_id, to_district_id, to_ward_id, 
        from_officer_id, to_officer_id, 
        transferred_by, transfer_reason, transfer_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        case_id, from_region_id, from_district_id, from_ward_id,
        updateFields.region_id || from_region_id, updateFields.district_id || from_district_id, updateFields.ward_id || from_ward_id,
        from_officer_id, to_officer_id || from_officer_id,
        req.user.id, reason, transfer_type
      ]
    );

    const transferId = transResult.insertId;

    // Log Action
    await connection.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [case_id, req.user.id, `CASE_${transfer_type.toUpperCase()}_TRANSFER`, reason, caseRow.status, updateFields.status || caseRow.status]
    );

    // BLOCKCHAIN TRIGGER: Generate new proof if location or officer changes significantly
    // Especially if confirmed previously
    if (caseRow.status === 'confirmed_by_ward_commander' || caseRow.status === 'under_investigation') {
      const snapshot = { 
        ob_number: caseRow.ob_number, 
        title: caseRow.title,
        location: { region: updateFields.region_id, district: updateFields.district_id, ward: updateFields.ward_id },
        assigned_officer: to_officer_id,
        transfer_id: transferId
      };
      const bcRecordId = await saveBlockchainRecord('case', case_id, snapshot, req.user.id);
      
      // Link blockchain record to transfer history
      await connection.query('UPDATE case_transfers SET blockchain_record_id = ? WHERE id = ?', [bcRecordId, transferId]);
    }

    await connection.commit();
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'TRANSFER_CASE', entityType: 'cases', entityId: parseInt(case_id), newData: updateFields });

    res.json({ success: true, message: 'Transfer completed successfully.', transferId });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

const getTransferHistory = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT ct.*, 
             u.full_name AS transferred_by_name,
             fo.full_name AS from_officer_name,
             to_off.full_name AS to_officer_name,
             fr.name AS from_region_name,
             tr.name AS to_region_name
      FROM case_transfers ct
      JOIN users u ON ct.transferred_by = u.id
      LEFT JOIN users fo ON ct.from_officer_id = fo.id
      LEFT JOIN users to_off ON ct.to_officer_id = to_off.id
      LEFT JOIN regions fr ON ct.from_region_id = fr.id
      LEFT JOIN regions tr ON ct.to_region_id = tr.id
      WHERE ct.case_id = ?
      ORDER BY ct.transferred_at DESC
    `, [req.params.caseId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { transferCase, getTransferHistory };
