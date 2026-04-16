// src/controllers/userController.js — CRUD for user management (Admin only)
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

/** GET /api/users — List all users */
const getUsers = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.badge_number, u.full_name, u.email, u.phone, u.rank, u.is_active,
              u.last_login, u.created_at,
              r.name AS role,
              s.name AS station_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN stations s ON u.station_id = s.id
       ORDER BY u.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** GET /api/users/:id — Get single user */
const getUserById = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.badge_number, u.full_name, u.email, u.phone, u.rank, u.is_active,
              u.last_login, u.created_at, u.station_id,
              r.id AS role_id, r.name AS role,
              s.name AS station_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN stations s ON u.station_id = s.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

/** POST /api/users — Create new user */
const createUser = async (req, res, next) => {
  try {
    const { role_id, station_id, badge_number, full_name, email, phone, password, rank } = req.body;
    if (!full_name || !email || !password || !role_id) {
      return res.status(400).json({ success: false, message: 'full_name, email, password, role_id are required.' });
    }
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      `INSERT INTO users (role_id, station_id, badge_number, full_name, email, phone, password_hash, rank)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [role_id, station_id || null, badge_number || null, full_name, email.toLowerCase(), phone || null, hash, rank || null]
    );
    await writeAuditLog({
      userId: req.user.id, userEmail: req.user.email,
      action: 'CREATE_USER', entityType: 'users', entityId: result.insertId,
      newData: { full_name, email, role_id },
    });
    res.status(201).json({ success: true, message: 'User created.', userId: result.insertId });
  } catch (err) { next(err); }
};

/** PUT /api/users/:id — Update user */
const updateUser = async (req, res, next) => {
  try {
    const { full_name, email, phone, rank, role_id, station_id, is_active, password } = req.body;
    const [existing] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'User not found.' });

    let hashUpdate = '';
    const params = [];

    if (full_name) { params.push(['full_name', full_name]); }
    if (email) { params.push(['email', email.toLowerCase()]); }
    if (phone !== undefined) { params.push(['phone', phone]); }
    if (rank !== undefined) { params.push(['rank', rank]); }
    if (role_id) { params.push(['role_id', role_id]); }
    if (station_id !== undefined) { params.push(['station_id', station_id]); }
    if (is_active !== undefined) { params.push(['is_active', is_active ? 1 : 0]); }

    const setClauses = params.map(([col]) => `${col} = ?`).join(', ');
    const values = params.map(([, v]) => v);

    let sql = `UPDATE users SET ${setClauses}`;
    if (password) {
      const newHash = await bcrypt.hash(password, 12);
      sql += ', password_hash = ?';
      values.push(newHash);
    }
    sql += ' WHERE id = ?';
    values.push(req.params.id);

    await db.query(sql, values);
    await writeAuditLog({
      userId: req.user.id, userEmail: req.user.email,
      action: 'UPDATE_USER', entityType: 'users', entityId: parseInt(req.params.id),
      oldData: existing[0], newData: req.body,
    });
    res.json({ success: true, message: 'User updated.' });
  } catch (err) { next(err); }
};

/** DELETE /api/users/:id — Deactivate user (soft delete) */
const deleteUser = async (req, res, next) => {
  try {
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    await writeAuditLog({
      userId: req.user.id, userEmail: req.user.email,
      action: 'DEACTIVATE_USER', entityType: 'users', entityId: parseInt(req.params.id),
    });
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) { next(err); }
};

/** GET /api/users/roles — Get all roles */
const getRoles = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM roles ORDER BY id');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { getUsers, getUserById, createUser, updateUser, deleteUser, getRoles };
