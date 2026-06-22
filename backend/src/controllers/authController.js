// src/controllers/authController.js — Login and token refresh handlers
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { normalizeRole } = require('../utils/locationScope');

/**
 * POST /api/auth/login
 * Validate credentials, return signed JWT
 */
const login = async (req, res, next) => {
  try {
    const usernameInput = req.body.username || req.body.email;
    const { password } = req.body;
    
    if (!usernameInput || !password) {
      return res.status(400).json({ success: false, message: 'Username/Email and password are required.' });
    }
    
    const identifier = usernameInput.toLowerCase().trim();

    // Look up across all login-capable tables
    const sql = `
      SELECT id, username, email, password_hash, is_active, role, full_name, profile_image,
             phone, \`rank\`, user_type, assigned_level, is_commander,
             state_administration_id, region_id, district_id,
             state_name, region_name, district_name,
             NULL AS scope_type, NULL as scope_id
      FROM (
        SELECT u.id, u.username, u.email, u.password_hash,
               CASE WHEN u.status = 'ACTIVE' THEN u.is_active ELSE 0 END AS is_active,
               (SELECT name FROM roles WHERE id = role_id) AS role, 
               u.full_name, u.profile_image, u.phone, u.\`rank\`, u.user_type, u.assigned_level, u.is_commander,
               u.state_administration_id, u.region_id, u.district_id,
               sa.state_name, r.region_name, d.district_name
        FROM users u
        LEFT JOIN state_administrations sa ON u.state_administration_id = sa.id
        LEFT JOIN regions r ON u.region_id = r.id
        LEFT JOIN districts d ON u.district_id = d.id
        WHERE u.username = ? OR u.email = ?
      ) u
      UNION ALL
      SELECT id, username, NULL as email, password_hash, 1 as is_active, 'state_admin' as role, state_name as full_name, NULL as profile_image,
             NULL, NULL, 'COMMANDER', 'STATE', 1, id, NULL, NULL, state_name, NULL, NULL, 'state_administration' as scope_type, id as scope_id
      FROM state_administrations WHERE username = ?
      UNION ALL
      SELECT r.id, r.username, NULL as email, r.password_hash, 1 as is_active, 'region_admin' as role, r.region_name as full_name, NULL as profile_image,
             NULL, NULL, 'COMMANDER', 'REGION', 1, r.state_administration_id, r.id, NULL, sa.state_name, r.region_name, NULL, 'region' as scope_type, r.id as scope_id
      FROM regions r LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id WHERE r.username = ?
      UNION ALL
      SELECT c.id, c.username, NULL as email, c.password_hash, 1 as is_active, 'city_admin' as role, c.city_name as full_name, NULL as profile_image,
             NULL, NULL, 'COMMANDER', 'REGION', 1, r.state_administration_id, r.id, NULL, sa.state_name, r.region_name, NULL, 'city' as scope_type, c.id as scope_id
      FROM cities c LEFT JOIN regions r ON c.region_id = r.id LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id WHERE c.username = ?
      UNION ALL
      SELECT d.id, d.username, NULL as email, d.password_hash, 1 as is_active, 'district_admin' as role, d.district_name as full_name, NULL as profile_image,
             NULL, NULL, 'COMMANDER', 'DISTRICT_POLICE_STATION', 1, r.state_administration_id, r.id, d.id, sa.state_name, r.region_name, d.district_name, 'district' as scope_type, d.id as scope_id
      FROM districts d LEFT JOIN cities c ON d.city_id = c.id LEFT JOIN regions r ON c.region_id = r.id LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id WHERE d.username = ?
    `;

    const [rows] = await db.query(sql, [
      identifier, identifier, 
      identifier, 
      identifier, 
      identifier, 
      identifier
    ]);

    if (!rows.length) {
      await db.query(
        `INSERT INTO login_logs (username, success, failure_reason, ip_address, user_agent)
         VALUES (?, 0, ?, ?, ?)`,
        [identifier, 'Invalid credentials', req.ip, req.headers['user-agent']]
      );
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = rows[0];
    if (user.is_active === 0) {
      await db.query(
        `INSERT INTO login_logs (user_id, username, success, failure_reason, ip_address, user_agent)
         VALUES (?, ?, 0, ?, ?, ?)`,
        [user.id, user.username, 'Account is deactivated', req.ip, req.headers['user-agent']]
      );
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await db.query(
        `INSERT INTO login_logs (user_id, username, success, failure_reason, ip_address, user_agent)
         VALUES (?, ?, 0, ?, ?, ?)`,
        [user.id, user.username, 'Invalid credentials', req.ip, req.headers['user-agent']]
      );
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    // Update last_login only if it's a regular user, centers don't have last_login
    if (!user.scope_type) {
      await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    }

    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: normalizeRole(user.role),
      roleCode: user.role,
      fullName: user.full_name,
      phone: user.phone,
      rank: user.rank,
      userType: user.user_type,
      assignedLevel: user.assigned_level,
      isCommander: Boolean(user.is_commander),
      profileImage: user.profile_image,
      scopeType: user.scope_type,
      scopeId: user.scope_id,
      location: {
        stateId: user.state_administration_id,
        stateName: user.state_name,
        regionId: user.region_id,
        regionName: user.region_name,
        districtId: user.district_id,
        districtName: user.district_name
      }
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    });

    await writeAuditLog({
      userId: user.username,
      userEmail: user.email || user.username,
      action: 'LOGIN',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    await db.query(
      `INSERT INTO login_logs (user_id, username, success, ip_address, user_agent)
       VALUES (?, ?, 1, ?, ?)`,
      [user.id, user.username, req.ip, req.headers['user-agent']]
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: payload
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/logout
 */
const logout = async (req, res, next) => {
  try {
    if (req.user) {
      await writeAuditLog({
        userId: req.user.username,
        userEmail: req.user.email || req.user.username,
        action: 'LOGOUT',
        ipAddress: req.ip,
      });
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { login, logout, getMe };
