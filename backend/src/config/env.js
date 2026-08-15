// src/config/env.js - Environment validation for application startup
'use strict';

require('dotenv').config();

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

function isPlaceholder(value) {
  if (!value) return true;
  return /change_me|your_|<.*>|placeholder/i.test(value);
}

function isLocalMongoUri(uri) {
  return /^mongodb:\/\/(127\.0\.0\.1|localhost)(:|\/)/i.test(uri || '');
}

function getDatabaseUrl() {
  return process.env.MYSQL_PRIVATE_URL || process.env.MYSQL_URL || process.env.DATABASE_URL;
}

function validateEnv() {
  const missing = [];
  const databaseUrl = getDatabaseUrl();

  if (isProduction) {
    if (!databaseUrl) {
      ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].forEach((name) => {
        if (!process.env[name]) missing.push(name);
      });
    }

    if (isPlaceholder(process.env.JWT_SECRET)) {
      missing.push('JWT_SECRET');
    }

    if (process.env.MONGODB_URI && isLocalMongoUri(process.env.MONGODB_URI)) {
      throw new Error(
        'Invalid production MONGODB_URI: localhost/127.0.0.1 MongoDB is only valid for local development. Use an external MongoDB URI or unset MONGODB_URI.'
      );
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }

  if (isProduction && !process.env.FRONTEND_URL) {
    console.warn('FRONTEND_URL is not set. Browser requests from the deployed frontend may be blocked by CORS.');
  }
}

function getAllowedOrigins() {
  const configuredOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return isProduction
    ? configuredOrigins
    : [...new Set([...configuredOrigins, ...DEFAULT_DEV_ORIGINS])];
}

module.exports = {
  NODE_ENV,
  isProduction,
  port: process.env.PORT || 5000,
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  getAllowedOrigins,
  getDatabaseUrl,
  isLocalMongoUri,
  validateEnv,
};
