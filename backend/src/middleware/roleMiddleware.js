// src/middleware/roleMiddleware.js — Role-based authorization gate
'use strict';

const { normalizeRole } = require('../utils/locationScope');

/**
 * Middleware factory: Allow only specified roles.
 * Usage: router.get('/admin', authMiddleware, allowRoles('admin'), handler)
 * @param {...string} roles - Allowed role names (e.g. 'admin', 'officer')
 */
const allowRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized.' });
    }
    const userRole = normalizeRole(req.user.role);
    const allowedRoles = roles.map(normalizeRole);
    if (userRole === 'admin') {
      return next();
    }
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}. Your role: ${userRole}`,
      });
    }
    next();
  };
};

module.exports = { allowRoles };
