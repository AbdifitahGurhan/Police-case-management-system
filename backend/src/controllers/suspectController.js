// src/controllers/suspectController.js
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const getSuspects = async (req, res, next) => {
  try {
    const { case_id, search } = req.query;
    if (case_id) {
      const [rows] = await db.query(
        `SELECT s.*, cs.role_in_case, cs.notes AS case_notes FROM suspects s
         JOIN case_suspects cs ON s.id = cs.suspect_id WHERE cs.case_id = ?`, [case_id]);
      return res.json({ success: true, data: rows });
    }
    let sql = 'SELECT * FROM suspects WHERE 1=1';
    const params = [];
    if (search) { sql += ' AND (full_name LIKE ? OR alias LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    const [rows] = await db.query(sql + ' ORDER BY full_name ASC', params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getSuspectById = async (req, res, next) => {
  try {
    const [[row]] = await db.query('SELECT * FROM suspects WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ success: false, message: 'Suspect not found.' });
    const [cases] = await db.query(
      `SELECT c.id, c.ob_number, c.title, cs.role_in_case FROM cases c JOIN case_suspects cs ON c.id = cs.case_id WHERE cs.suspect_id = ?`, [req.params.id]);
    res.json({ success: true, data: { ...row, cases } });
  } catch (err) { next(err); }
};

const createSuspect = async (req, res, next) => {
  try {
    const { case_id, full_name, alias, gender, age, nationality, phone, address, description, role_in_case } = req.body;
    if (!full_name) return res.status(400).json({ success: false, message: 'full_name is required.' });
    const [result] = await db.query(
      `INSERT INTO suspects (full_name, alias, gender, age, nationality, phone, address, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, alias || null, gender || 'male', age || null, nationality || 'Somali', phone || null, address || null, description || null]
    );
    const suspectId = result.insertId;
    if (case_id) {
      await db.query(`INSERT INTO case_suspects (case_id, suspect_id, role_in_case, added_by) VALUES (?, ?, ?, ?)`,
        [case_id, suspectId, role_in_case || null, req.user.id]);
    }
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_SUSPECT', entityType: 'suspects', entityId: suspectId, newData: req.body });
    res.status(201).json({ success: true, message: 'Suspect added.', suspectId });
  } catch (err) { next(err); }
};

const updateSuspect = async (req, res, next) => {
  try {
    const { full_name, alias, gender, age, nationality, phone, address, description, is_arrested } = req.body;
    await db.query(`UPDATE suspects SET full_name=?, alias=?, gender=?, age=?, nationality=?, phone=?, address=?, description=?, is_arrested=? WHERE id=?`,
      [full_name, alias, gender, age, nationality, address, phone, description, is_arrested ? 1 : 0, req.params.id]);
    res.json({ success: true, message: 'Suspect updated.' });
  } catch (err) { next(err); }
};

module.exports = { getSuspects, getSuspectById, createSuspect, updateSuspect };
