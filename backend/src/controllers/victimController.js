// src/controllers/victimController.js
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const getVictims = async (req, res, next) => {
  try {
    const { case_id } = req.query;
    if (case_id) {
      const [rows] = await db.query(
        `SELECT v.*, cv.notes AS case_notes FROM victims v
         JOIN case_victims cv ON v.id = cv.victim_id WHERE cv.case_id = ?`, [case_id]);
      return res.json({ success: true, data: rows });
    }
    const [rows] = await db.query('SELECT * FROM victims ORDER BY full_name ASC');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const createVictim = async (req, res, next) => {
  try {
    const { case_id, full_name, gender, age, nationality, phone, address, injury_description } = req.body;
    if (!full_name) return res.status(400).json({ success: false, message: 'full_name is required.' });
    const [result] = await db.query(
      `INSERT INTO victims (full_name, gender, age, nationality, phone, address, injury_description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [full_name, gender || 'male', age || null, nationality || 'Somali', phone || null, address || null, injury_description || null]
    );
    const victimId = result.insertId;
    if (case_id) {
      await db.query(`INSERT INTO case_victims (case_id, victim_id, added_by) VALUES (?, ?, ?)`,
        [case_id, victimId, req.user.id]);
    }
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_VICTIM', entityType: 'victims', entityId: victimId });
    res.status(201).json({ success: true, message: 'Victim added.', victimId });
  } catch (err) { next(err); }
};

module.exports = { getVictims, createVictim };
