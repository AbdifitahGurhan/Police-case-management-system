'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const fields = ['personnel_type', 'full_name', 'identification_number', 'phone_number', 'email', 'court_or_office', 'position', 'status'];
const validType = (value) => ['judge', 'prosecutor'].includes(value);

const list = async (req, res, next) => {
  try {
    const { type, status, search = '', page = 1, limit = 20 } = req.query;
    const params = [];
    let where = '1=1';
    if (type) { where += ' AND personnel_type = ?'; params.push(type); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (search) { where += ' AND (full_name LIKE ? OR identification_number LIKE ? OR court_or_office LIKE ?)'; params.push(...Array(3).fill(`%${search}%`)); }
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (Math.max(1, Number(page) || 1) - 1) * safeLimit;
    const [[count]] = await db.query(`SELECT COUNT(*) total FROM legal_personnel WHERE ${where}`, params);
    const [rows] = await db.query(`SELECT * FROM legal_personnel WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, safeLimit, offset]);
    res.json({ success: true, data: rows, pagination: { page: Number(page), limit: safeLimit, total: count.total } });
  } catch (error) { next(error); }
};

const options = async (req, res, next) => {
  try {
    const type = req.query.type;
    if (!validType(type)) return res.status(400).json({ success: false, message: 'type must be judge or prosecutor.' });

    const [lpRows] = await db.query(
      "SELECT id AS value, full_name AS label, court_or_office FROM legal_personnel WHERE personnel_type=? AND status='active' ORDER BY full_name",
      [type]
    );

    const roleFilter = type === 'judge' ? ['judge'] : ['prosecutor', 'prosecutor_liaison'];
    const [userRows] = await db.query(
      `SELECT u.id AS value, u.full_name AS label, 'Court / Legal System' AS court_or_office 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE LOWER(r.name) IN (?) AND u.is_active = 1 
       ORDER BY u.full_name`,
      [roleFilter]
    );

    const combinedMap = new Map();
    for (const item of lpRows) combinedMap.set(item.label.toLowerCase(), item);
    for (const item of userRows) {
      if (!combinedMap.has(item.label.toLowerCase())) {
        combinedMap.set(item.label.toLowerCase(), item);
      }
    }

    res.json({ success: true, data: Array.from(combinedMap.values()) });
  } catch (error) { next(error); }
};

const create = async (req, res, next) => {
  try {
    const data = Object.fromEntries(fields.map((key) => [key, req.body[key]]));
    if (!validType(data.personnel_type) || !data.full_name || !data.identification_number || !data.court_or_office || !data.position) {
      return res.status(400).json({ success: false, message: 'Type, full name, identification number, court/office, and position are required.' });
    }
    const [result] = await db.query(`INSERT INTO legal_personnel (${fields.join(',')},created_by) VALUES (?,?,?,?,?,?,?,?,?)`, [...fields.map((key) => data[key] || (key === 'status' ? 'active' : null)), req.user.id]);
    const [[created]] = await db.query('SELECT * FROM legal_personnel WHERE id=?', [result.insertId]);
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_LEGAL_PERSONNEL', entityType: 'legal_personnel', entityId: result.insertId, newData: created, ipAddress: req.ip });
    res.status(201).json({ success: true, data: created });
  } catch (error) { next(error); }
};

const update = async (req, res, next) => {
  try {
    const [[oldData]] = await db.query('SELECT * FROM legal_personnel WHERE id=?', [req.params.id]);
    if (!oldData) return res.status(404).json({ success: false, message: 'Legal personnel record not found.' });
    const updates = fields.filter((key) => req.body[key] !== undefined);
    if (!updates.length) return res.status(400).json({ success: false, message: 'No update fields provided.' });
    if (req.body.personnel_type && !validType(req.body.personnel_type)) return res.status(400).json({ success: false, message: 'Invalid personnel type.' });
    await db.query(`UPDATE legal_personnel SET ${updates.map((key) => `${key}=?`).join(',')} WHERE id=?`, [...updates.map((key) => req.body[key]), req.params.id]);
    const [[newData]] = await db.query('SELECT * FROM legal_personnel WHERE id=?', [req.params.id]);
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE_LEGAL_PERSONNEL', entityType: 'legal_personnel', entityId: Number(req.params.id), oldData, newData, ipAddress: req.ip });
    res.json({ success: true, data: newData });
  } catch (error) { next(error); }
};

module.exports = { list, options, create, update };
