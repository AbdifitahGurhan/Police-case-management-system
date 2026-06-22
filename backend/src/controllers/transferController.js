// src/controllers/transferController.js - Case transfer logic
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { saveBlockchainRecord } = require('../utils/hashUtil');

/** POST /api/transfers - Perform case location and/or officer transfer */
const transferCase = async (req, res, next) => {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const {
      case_id,
      transfer_type,
      to_state_administration_id,
      to_region_id,
      to_city_id,
      to_district_id,
      to_officer_id,
      reason,
    } = req.body;

    if (!case_id || !transfer_type || !reason) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: 'case_id, transfer_type, and reason are required.' });
    }

    const [[caseRow]] = await connection.query('SELECT * FROM cases WHERE id = ?', [case_id]);
    if (!caseRow) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Case not found.' });
    }

    const updateFields = {};

    if (transfer_type === 'location' || transfer_type === 'both') {
      updateFields.state_administration_id = to_state_administration_id || caseRow.state_administration_id;
      updateFields.region_id = to_region_id || caseRow.region_id;
      updateFields.city_id = to_city_id || caseRow.city_id;
      updateFields.district_id = to_district_id || caseRow.district_id;
      updateFields.status = 'TRANSFERRED';
    }

    if (transfer_type === 'officer' || transfer_type === 'both') {
      updateFields.assigned_officer_id = to_officer_id || caseRow.assigned_officer_id;
      if (transfer_type === 'officer') updateFields.status = 'REASSIGNED';
    }

    const fieldNames = Object.keys(updateFields);
    if (fieldNames.length > 0) {
      const setClause = fieldNames.map((field) => `${field} = ?`).join(', ');
      await connection.query(
        `UPDATE cases SET ${setClause} WHERE id = ?`,
        [...fieldNames.map((field) => updateFields[field]), case_id]
      );
    }

    const [transferResult] = await connection.query(
      `INSERT INTO case_transfers (
         case_id,
         from_state_administration_id, from_region_id, from_city_id, from_district_id,
         to_state_administration_id, to_region_id, to_city_id, to_district_id,
         from_officer_id, to_officer_id,
         transferred_by, transfer_reason, transfer_type
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        case_id,
        caseRow.state_administration_id, caseRow.region_id, caseRow.city_id, caseRow.district_id,
        updateFields.state_administration_id || caseRow.state_administration_id,
        updateFields.region_id || caseRow.region_id,
        updateFields.city_id || caseRow.city_id,
        updateFields.district_id || caseRow.district_id,
        caseRow.assigned_officer_id,
        updateFields.assigned_officer_id || caseRow.assigned_officer_id,
        req.user.username || String(req.user.id),
        reason,
        transfer_type,
      ]
    );

    const transferId = transferResult.insertId;

    await connection.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        case_id,
        req.user.username || String(req.user.id),
        `CASE_${transfer_type.toUpperCase()}_TRANSFER`,
        reason,
        caseRow.status,
        updateFields.status || caseRow.status,
      ]
    );

    if (['CONFIRMED_BY_COMMANDER', 'UNDER_INVESTIGATION'].includes(caseRow.status)) {
      const snapshot = {
        ob_number: caseRow.ob_number,
        title: caseRow.title || caseRow.case_title,
        location: {
          region_id: updateFields.region_id || caseRow.region_id,
          district_id: updateFields.district_id || caseRow.district_id,
        },
        assigned_officer_id: updateFields.assigned_officer_id || caseRow.assigned_officer_id,
        transfer_id: transferId,
      };
      const blockchainRecordId = await saveBlockchainRecord('case', case_id, snapshot, req.user.username || String(req.user.id));
      await connection.query('UPDATE case_transfers SET blockchain_record_id = ? WHERE id = ?', [blockchainRecordId, transferId]);
    }

    await connection.commit();
    await writeAuditLog({
      userId: req.user.username || String(req.user.id),
      userEmail: req.user.email,
      action: 'TRANSFER_CASE',
      entityType: 'cases',
      entityId: parseInt(case_id, 10),
      newData: updateFields,
    });

    res.json({ success: true, message: 'Transfer completed successfully.', transferId });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const getTransferHistory = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT ct.*,
              u.full_name AS transferred_by_name,
              fo.full_name AS from_officer_name,
              to_off.full_name AS to_officer_name,
              fr.region_name AS from_region_name,
              tr.region_name AS to_region_name,
              fd.district_name AS from_district_name,
              td.district_name AS to_district_name
       FROM case_transfers ct
       LEFT JOIN users u ON ct.transferred_by = u.username OR ct.transferred_by = CAST(u.id AS CHAR)
       LEFT JOIN police_officers fo ON ct.from_officer_id = fo.id
       LEFT JOIN police_officers to_off ON ct.to_officer_id = to_off.id
       LEFT JOIN regions fr ON ct.from_region_id = fr.id
       LEFT JOIN regions tr ON ct.to_region_id = tr.id
       LEFT JOIN districts fd ON ct.from_district_id = fd.id
       LEFT JOIN districts td ON ct.to_district_id = td.id
       WHERE ct.case_id = ?
       ORDER BY ct.transferred_at DESC`,
      [req.params.caseId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { transferCase, getTransferHistory };
