// src/middleware/roleMiddleware.js — Role-based authorization gate
'use strict';

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
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}. Your role: ${req.user.role}`,
      });
    }
    next();
  };
};

module.exports = { allowRoles };
