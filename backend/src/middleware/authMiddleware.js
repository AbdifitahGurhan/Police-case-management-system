// src/middleware/authMiddleware.js — Verifies JWT on all protected routes
'use strict';

const jwt = require('jsonwebtoken');

/**
 * Middleware: Verifies the Authorization Bearer token.
 * Attaches decoded user payload to req.user.
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, username, email, role, fullName, scopeType, scopeId }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token has expired. Please log in again.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
};

module.exports = authMiddleware;
