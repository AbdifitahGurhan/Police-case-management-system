// src/controllers/authController.js — Login and token refresh handlers
'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

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
      SELECT id, username, email, password_hash, is_active, role, full_name, NULL AS scope_type, NULL as scope_id
      FROM (
        SELECT id, username, email, password_hash, is_active, 
               (SELECT name FROM roles WHERE id = role_id) AS role, 
               full_name
        FROM users
        WHERE username = ? OR email = ?
      ) u
      UNION ALL
      SELECT id, username, NULL as email, password_hash, 1 as is_active, 'state_admin' as role, state_name as full_name, 'state_administration' as scope_type, id as scope_id
      FROM state_administrations WHERE username = ?
      UNION ALL
      SELECT id, username, NULL as email, password_hash, 1 as is_active, 'region_admin' as role, region_name as full_name, 'region' as scope_type, id as scope_id
      FROM regions WHERE username = ?
      UNION ALL
      SELECT id, username, NULL as email, password_hash, 1 as is_active, 'city_admin' as role, city_name as full_name, 'city' as scope_type, id as scope_id
      FROM cities WHERE username = ?
      UNION ALL
      SELECT id, username, NULL as email, password_hash, 1 as is_active, 'district_admin' as role, district_name as full_name, 'district' as scope_type, id as scope_id
      FROM districts WHERE username = ?
      UNION ALL
      SELECT id, username, NULL as email, password_hash, 1 as is_active, 'neighborhood_admin' as role, neighborhood_name as full_name, 'neighborhood' as scope_type, id as scope_id
      FROM neighborhoods WHERE username = ?
      UNION ALL
      SELECT id, username, NULL as email, password_hash, is_active, LOWER(role) as role, username as full_name, 'special_user' as scope_type, id as scope_id
      FROM special_users WHERE username = ?
    `;

    const [rows] = await db.query(sql, [
      identifier, identifier, 
      identifier, 
      identifier, 
      identifier, 
      identifier, 
      identifier,
      identifier
    ]);

    if (!rows.length) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    const user = rows[0];
    if (user.is_active === 0) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
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
      role: user.role,
      fullName: user.full_name,
      scopeType: user.scope_type,
      scopeId: user.scope_id
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
