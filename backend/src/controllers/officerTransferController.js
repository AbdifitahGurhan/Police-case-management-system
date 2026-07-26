'use strict';
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

exports.transferOfficer = async (req, res, next) => {
  const connection = await db.pool.getConnection();
  try {
    await connection.beginTransaction();

    const { officer_id, to_assignment_type, to_assignment_id, transfer_reason, remarks } = req.body;

    if (!officer_id || !to_assignment_type || !transfer_reason) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // 1. Get current active assignment for transfer history
    const [currentRows] = await connection.query('SELECT * FROM officer_assignments WHERE officer_id = ? AND is_current = 1 ORDER BY assigned_at DESC LIMIT 1', [officer_id]);
    const currentAssignment = currentRows.length ? currentRows[0] : null;

    // 2. Deactivate ALL previous active assignments for this officer to ensure single active location
    await connection.query('UPDATE officer_assignments SET is_current = 0 WHERE officer_id = ?', [officer_id]);

    // 3. Clear this officer from being commander of any other station/unit across all tiers
    await connection.query('UPDATE state_administrations SET commander_officer_id = NULL WHERE commander_officer_id = ?', [officer_id]);
    await connection.query('UPDATE regions SET commander_officer_id = NULL WHERE commander_officer_id = ?', [officer_id]);
    await connection.query('UPDATE cities SET commander_officer_id = NULL WHERE commander_officer_id = ?', [officer_id]);
    await connection.query('UPDATE districts SET commander_officer_id = NULL WHERE commander_officer_id = ?', [officer_id]);

    // 4. Create new single active assignment
    await connection.query(
      `INSERT INTO officer_assignments (officer_id, assignment_type, assignment_id, is_current, assigned_by, remarks)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [officer_id, to_assignment_type, to_assignment_id || null, req.user.username, remarks]
    );

    // 5. Record transfer in history
    await connection.query(
      `INSERT INTO officer_transfers (officer_id, from_assignment_type, from_assignment_id, to_assignment_type, to_assignment_id, transfer_reason, transferred_by, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        officer_id,
        currentAssignment ? currentAssignment.assignment_type : null,
        currentAssignment ? currentAssignment.assignment_id : null,
        to_assignment_type,
        to_assignment_id || null,
        transfer_reason,
        req.user.username,
        remarks
      ]
    );

    // 6. Assign commander on the target center profile if applicable
    const tableMap = {
      'State Administration': 'state_administrations',
      'Region': 'regions',
      'City': 'cities',
      'District': 'districts',
      'District Station': 'districts'
    };

    if (to_assignment_id && tableMap[to_assignment_type]) {
      const table = tableMap[to_assignment_type];
      await connection.query(`UPDATE ${table} SET commander_officer_id = ? WHERE id = ?`, [officer_id, to_assignment_id]);
    }

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'OFFICER_TRANSFER',
      entityType: 'police_officers',
      entityId: officer_id,
      details: transfer_reason
    });

    await connection.commit();
    res.json({ success: true, message: 'Officer transferred successfully' });
  } catch (err) {
    if (connection) await connection.rollback();
    next(err);
  } finally {
    if (connection) connection.release();
  }
};

exports.getTransferHistory = async (req, res, next) => {
  try {
    const { officer_id } = req.params;
    const [rows] = await db.query('SELECT * FROM officer_transfers WHERE officer_id = ? ORDER BY transferred_at DESC', [officer_id]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};
