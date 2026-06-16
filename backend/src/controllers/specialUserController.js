'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

/** GET /api/special-users — List all special users optionally filtered by role */
const getSpecialUsers = async (req, res, next) => {
  try {
    const { role } = req.query;
    let sql = 'SELECT id, username, role, assigned_unit, created_by, is_active, created_at, updated_at FROM special_users';
    const params = [];
    if (role) {
      sql += ' WHERE role = ?';
      params.push(role.toUpperCase());
    }
    sql += ' ORDER BY created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** GET /api/special-users/:id — Get a single special user */
const getSpecialUserById = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, username, role, assigned_unit, created_by, is_active, created_at, updated_at FROM special_users WHERE id = ?',
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

/** POST /api/special-users — Create a special user */
const createSpecialUser = async (req, res, next) => {
  try {
    const { username, password, role, assigned_unit } = req.body;
    if (!username || !password || !role) {
      return res.status(400).json({ success: false, message: 'Username, password, and role are required.' });
    }

    // Role enum check
    const validRoles = ['ADMIN', 'CID', 'CID_DIRECTOR', 'CID_SUPERVISOR', 'CID_OFFICER', 'PROSECUTOR', 'PROSECUTOR_LIAISON', 'COURT', 'COURT_ADMIN', 'JUDGE', 'COURT_CLERK', 'JAIL'];
    if (!validRoles.includes(role.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const createdBy = req.user.username || 'System';

    const sql = `INSERT INTO special_users (username, password_hash, role, assigned_unit, created_by)
                 VALUES (?, ?, ?, ?, ?)`;
    const [result] = await db.query(sql, [username, hash, role.toUpperCase(), assigned_unit || null, createdBy]);

    await writeAuditLog({
      userId: req.user.id || req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'CREATE_SPECIAL_USER',
      entityType: 'special_users',
      entityId: result.insertId,
      newData: { username, role, assigned_unit },
    });

    res.status(201).json({ success: true, message: 'User created.', userId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Username already exists.' });
    }
    next(err);
  }
};

/** PUT /api/special-users/:id — Update a special user */
const updateSpecialUser = async (req, res, next) => {
  try {
    const { password, assigned_unit, is_active } = req.body;
    const [existing] = await db.query('SELECT * FROM special_users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'User not found.' });

    let hashUpdate = '';
    const params = [];

    if (assigned_unit !== undefined) { params.push(['assigned_unit', assigned_unit]); }
    if (is_active !== undefined) { params.push(['is_active', is_active ? 1 : 0]); }

    const setClauses = params.map(([col]) => `${col} = ?`).join(', ');
    const values = params.map(([, v]) => v);

    let sql = 'UPDATE special_users SET ';
    if (setClauses) sql += setClauses;

    if (password) {
      if (setClauses) sql += ', ';
      sql += 'password_hash = ?';
      values.push(await bcrypt.hash(password, 12));
    }

    if (!setClauses && !password) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    sql += ' WHERE id = ?';
    values.push(req.params.id);

    await db.query(sql, values);

    await writeAuditLog({
      userId: req.user.id || req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'UPDATE_SPECIAL_USER',
      entityType: 'special_users',
      entityId: parseInt(req.params.id),
      oldData: existing[0],
      newData: req.body,
    });

    res.json({ success: true, message: 'User updated.' });
  } catch (err) { next(err); }
};

/** DELETE /api/special-users/:id — Deactivate special user (soft delete) */
const deleteSpecialUser = async (req, res, next) => {
  try {
    await db.query('UPDATE special_users SET is_active = 0 WHERE id = ?', [req.params.id]);
    await writeAuditLog({
      userId: req.user.id || req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'DEACTIVATE_SPECIAL_USER',
      entityType: 'special_users',
      entityId: parseInt(req.params.id),
    });
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) { next(err); }
};

module.exports = { getSpecialUsers, getSpecialUserById, createSpecialUser, updateSpecialUser, deleteSpecialUser };
