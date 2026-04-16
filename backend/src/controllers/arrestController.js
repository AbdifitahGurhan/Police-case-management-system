// src/controllers/arrestController.js — Arrest management logic
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

/** GET /api/arrests?case_id=X */
const getArrests = async (req, res, next) => {
  try {
    const { case_id } = req.query;
    let sql = `
      SELECT a.*, s.full_name AS suspect_name, u.full_name AS arrested_by_name 
      FROM arrests a
      JOIN suspects s ON a.suspect_id = s.id
      JOIN users u ON a.arrested_by = u.id
    `;
    const params = [];
    if (case_id) {
      sql += ' WHERE a.case_id = ?';
      params.push(case_id);
    }
    const [rows] = await db.query(sql + ' ORDER BY a.arrest_date DESC', params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** POST /api/arrests — Record new arrest */
const createArrest = async (req, res, next) => {
  try {
    const { case_id, suspect_id, arrest_date, arrest_location, charges, bail_status, bail_amount, notes } = req.body;
    
    if (!case_id || !suspect_id) {
      return res.status(400).json({ success: false, message: 'case_id and suspect_id are required.' });
    }

    const [result] = await db.query(
      `INSERT INTO arrests (case_id, suspect_id, arrested_by, arrest_date, arrest_location, charges, bail_status, bail_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [case_id, suspect_id, req.user.id, arrest_date || new Date(), arrest_location || null, charges || null, bail_status || 'no_bail', bail_amount || 0, notes || null]
    );

    const arrestId = result.insertId;

    // Update suspect status
    await db.query('UPDATE suspects SET is_arrested = 1 WHERE id = ?', [suspect_id]);

    // Update case timeline
    await db.query(`INSERT INTO case_actions (case_id, performed_by, action_type, description) VALUES (?, ?, ?, ?)`,
      [case_id, req.user.id, 'SUSPECT_ARRESTED', `Suspect ID ${suspect_id} has been arrested.`]);

    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'RECORD_ARREST',
      entityType: 'arrests',
      entityId: arrestId,
      newData: req.body
    });

    res.status(201).json({ success: true, message: 'Arrest record created.', arrestId });
  } catch (err) { next(err); }
};

module.exports = { getArrests, createArrest };
