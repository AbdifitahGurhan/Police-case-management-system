// src/controllers/userController.js — CRUD for user management (Admin only)
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { normalizeRole } = require('../utils/locationScope');

const REGION_ASSIGNABLE_ROLES = new Set([
  'staff',
  'ob_staff',
  'officer',
  'district_admin',
  'district_commander',
  'police_station_commander'
]);

const REGION_ASSIGNABLE_USER_TYPES = new Set(['OB_STAFF', 'STAFF', 'COMMANDER']);

const ensureRegionAssignableRole = async (roleId) => {
  const [[role]] = await db.query('SELECT id, name FROM roles WHERE id = ?', [roleId]);
  if (!role || !REGION_ASSIGNABLE_ROLES.has(String(role.name).toLowerCase())) {
    const error = new Error('Region admins can only assign regional operational roles.');
    error.statusCode = 403;
    throw error;
  }
  return role;
};

const mapAuthUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  role: row.role,
  roleCode: row.role,
  fullName: row.full_name,
  profileImage: row.profile_image,
  scopeType: null,
  scopeId: null
});

/** GET /api/users — List all users */
const getUsers = async (req, res, next) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.user.scopeType === 'region') {
      where += ' AND u.region_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.role !== 'admin') {
      where += ' AND 1=0';
    }

    const [rows] = await db.query(
      `SELECT u.id, u.username, NULL AS badge_number, u.full_name, u.email, u.profile_image,
              u.phone, u.\`rank\`, u.user_type, u.assigned_level, u.is_commander,
              u.is_active, u.status, u.last_login, u.created_by, u.created_at,
              r.name AS role,
              sa.state_name,
              rg.region_name,
              d.district_name AS district_police_station_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN state_administrations sa ON u.state_administration_id = sa.id
       LEFT JOIN regions rg ON u.region_id = rg.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE ${where}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** GET /api/users/:id — Get single user */
const getUserById = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, NULL AS badge_number, u.full_name, u.email, u.profile_image,
              u.phone, u.\`rank\`, u.user_type, u.assigned_level, u.is_commander,
              u.is_active, u.status, u.last_login, u.created_by,
              u.created_at, r.id AS role_id, r.name AS role,
              u.state_administration_id, u.region_id, u.district_id,
              sa.state_name, rg.region_name, d.district_name AS district_police_station_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN state_administrations sa ON u.state_administration_id = sa.id
       LEFT JOIN regions rg ON u.region_id = rg.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user.scopeType === 'region' && Number(rows[0].region_id) !== Number(req.user.scopeId)) {
      return res.status(403).json({ success: false, message: 'You can only view users within your assigned region.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

/** POST /api/users — Create new user */
const createUser = async (req, res, next) => {
  try {
    let {
      role_id, username, full_name, email, password, phone, rank, user_type,
      assigned_level, state_administration_id, region_id, district_id,
      is_commander
    } = req.body;
    if (!full_name || !password || !role_id) {
      return res.status(400).json({ success: false, message: 'full_name, password, and role_id are required.' });
    }
    if (req.user.scopeType === 'region') {
      region_id = req.user.scopeId;
      if (!REGION_ASSIGNABLE_USER_TYPES.has(user_type || 'STAFF')) {
        return res.status(403).json({ success: false, message: 'Region admins can only create regional staff accounts.' });
      }
      await ensureRegionAssignableRole(role_id);
    }
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      `INSERT INTO users
        (role_id, username, full_name, email, phone, \`rank\`, user_type, assigned_level,
         state_administration_id, region_id, district_id,
         is_commander, password_hash, is_active, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?)`,
      [
        role_id,
        (username || email?.toLowerCase().split('@')[0] || full_name.toLowerCase().replace(/\s+/g, '.')).trim().toLowerCase(),
        full_name,
        email ? email.toLowerCase() : null,
        phone || null,
        rank || null,
        user_type || 'STAFF',
        assigned_level || null,
        state_administration_id || null,
        region_id || null,
        district_id || null,
        is_commander ? 1 : 0,
        hash,
        req.user.username || req.user.id,
      ]
    );
    await writeAuditLog({
      userId: req.user.id, userEmail: req.user.email,
      action: 'CREATE_USER', entityType: 'users', entityId: result.insertId,
      newData: { full_name, email, role_id, user_type, assigned_level, state_administration_id, region_id, district_id },
    });
    res.status(201).json({ success: true, message: 'User created.', userId: result.insertId });
  } catch (err) { next(err); }
};

/** PUT /api/users/:id — Update user */
const updateUser = async (req, res, next) => {
  try {
    let {
      full_name, email, username, role_id, is_active, status, password, phone, rank,
      user_type, assigned_level, state_administration_id, region_id, district_id,
      is_commander
    } = req.body;
    const [existing] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user.scopeType === 'region' && Number(existing[0].region_id) !== Number(req.user.scopeId)) {
      return res.status(403).json({ success: false, message: 'You can only manage users within your assigned region.' });
    }
    if (req.user.scopeType === 'region') {
      region_id = req.user.scopeId;
      if (user_type && !REGION_ASSIGNABLE_USER_TYPES.has(user_type)) {
        return res.status(403).json({ success: false, message: 'Region admins can only manage regional staff accounts.' });
      }
      if (role_id) {
        await ensureRegionAssignableRole(role_id);
      }
    }

    let hashUpdate = '';
    const params = [];

    if (full_name) { params.push(['full_name', full_name]); }
    if (email) { params.push(['email', email.toLowerCase()]); }
    if (username) { params.push(['username', username]); }
    if (role_id) { params.push(['role_id', role_id]); }
    if (is_active !== undefined) { params.push(['is_active', is_active ? 1 : 0]); }
    if (status) { params.push(['status', status]); }
    if (phone !== undefined) { params.push(['phone', phone || null]); }
    if (rank !== undefined) { params.push(['`rank`', rank || null]); }
    if (user_type) { params.push(['user_type', user_type]); }
    if (assigned_level !== undefined) { params.push(['assigned_level', assigned_level || null]); }
    if (state_administration_id !== undefined) { params.push(['state_administration_id', state_administration_id || null]); }
    if (region_id !== undefined) { params.push(['region_id', region_id || null]); }
    if (district_id !== undefined) { params.push(['district_id', district_id || null]); }
    if (is_commander !== undefined) { params.push(['is_commander', is_commander ? 1 : 0]); }

    if (!params.length && !password) {
      return res.status(400).json({ success: false, message: 'No update fields provided.' });
    }

    const setClauses = params.map(([col]) => `${col} = ?`).join(', ');
    const values = params.map(([, v]) => v);

    let sql = `UPDATE users SET ${setClauses || 'updated_at = updated_at'}`;
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

/** POST /api/users/me/profile-image — Update signed-in user's profile photo */
const updateMyProfileImage = async (req, res, next) => {
  try {
    if (req.user.scopeType) {
      return res.status(403).json({
        success: false,
        message: 'Profile image upload is available for system users only.'
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file.' });
    }

    const profileImage = `/uploads/profiles/${req.file.filename}`;
    await db.query('UPDATE users SET profile_image = ? WHERE id = ?', [profileImage, req.user.id]);

    const [rows] = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.profile_image, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_PROFILE_IMAGE',
      entityType: 'users',
      entityId: req.user.id,
      newData: { profile_image: profileImage },
    });

    res.json({
      success: true,
      message: 'Profile image updated.',
      profileImage,
      user: mapAuthUser(rows[0])
    });
  } catch (err) { next(err); }
};

/** PUT /api/users/me — Update signed-in user's profile details */
const updateMyProfile = async (req, res, next) => {
  try {
    if (req.user.scopeType) {
      return res.status(403).json({
        success: false,
        message: 'Profile editing is available for system users only.'
      });
    }

    const { full_name, username, email, password } = req.body;
    const [existing] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updates = [];
    const values = [];

    if (full_name) {
      updates.push('full_name = ?');
      values.push(full_name.trim());
    }
    if (username) {
      updates.push('username = ?');
      values.push(username.trim().toLowerCase());
    }
    if (email) {
      updates.push('email = ?');
      values.push(email.trim().toLowerCase());
    }
    if (password) {
      const newHash = await bcrypt.hash(password, 12);
      updates.push('password_hash = ?');
      values.push(newHash);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No profile fields provided.' });
    }

    values.push(req.user.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.profile_image, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_MY_PROFILE',
      entityType: 'users',
      entityId: req.user.id,
      oldData: existing[0],
      newData: { full_name, username, email, passwordChanged: Boolean(password) },
    });

    res.json({
      success: true,
      message: 'Profile updated.',
      user: { ...mapAuthUser(rows[0]), role: normalizeRole(rows[0].role) }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Username or email is already in use.' });
    }
    next(err);
  }
};

/** DELETE /api/users/:id — Deactivate user (soft delete) */
const deleteUser = async (req, res, next) => {
  try {
    if (req.user.scopeType === 'region') {
      const [[existing]] = await db.query('SELECT region_id FROM users WHERE id = ?', [req.params.id]);
      if (!existing || Number(existing.region_id) !== Number(req.user.scopeId)) {
        return res.status(403).json({ success: false, message: 'You can only manage users within your assigned region.' });
      }
    }
    await db.query("UPDATE users SET is_active = 0, status = 'INACTIVE' WHERE id = ?", [req.params.id]);
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
    const params = [];
    let where = '1=1';
    if (req.user.scopeType === 'region') {
      const assignableRoles = Array.from(REGION_ASSIGNABLE_ROLES);
      where = `LOWER(name) IN (${assignableRoles.map(() => '?').join(', ')})`;
      params.push(...assignableRoles);
    }
    const [rows] = await db.query(`SELECT * FROM roles WHERE ${where} ORDER BY id`, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { getUsers, getUserById, createUser, updateUser, updateMyProfile, updateMyProfileImage, deleteUser, getRoles };
