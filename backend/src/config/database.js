// src/config/database.js — MySQL connection pool using mysql2/promise
'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();
const { getDatabaseUrl, isProduction } = require('./env');

const dbUrl = getDatabaseUrl();

if (isProduction && !dbUrl) {
  const missing = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'].filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required MySQL environment variables: ${missing.join(', ')}`);
  }
}

const poolConfig = dbUrl
  ? {
      uri: dbUrl,
      waitForConnections: true,
      connectionLimit: 15,
      maxIdle: 10,
      idleTimeout: 30000, // Close idle connections after 30s before remote proxy drops them abruptly
      queueLimit: 0,
      connectTimeout: 20000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000, // Send TCP keep-alive packets every 10s
      dateStrings: ['DATE', 'DATETIME'],
      ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'police_cms',
      waitForConnections: true,
      connectionLimit: 15,
      maxIdle: 10,
      idleTimeout: 30000,
      queueLimit: 0,
      connectTimeout: 20000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
      dateStrings: ['DATE', 'DATETIME'],
    };

const pool = mysql.createPool(poolConfig);

// Catch background connection drops on idle pooled sockets
pool.on('error', (err) => {
  if (
    err.code === 'ECONNRESET' ||
    err.code === 'PROTOCOL_CONNECTION_LOST' ||
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'EPIPE'
  ) {
    console.warn(`⚠️ MySQL pool background event caught connection drop (${err.code}).`);
  } else {
    console.error('❌ Unexpected MySQL pool error:', err);
  }
});

/**
 * Check if error is a transient TCP/connection drop error.
 */
function isConnectionError(err) {
  if (!err) return false;
  const code = err.code || '';
  const message = err.message || '';
  return (
    code === 'ECONNRESET' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'EPIPE' ||
    code === 'ER_SERVER_SHUTDOWN' ||
    message.includes('ECONNRESET') ||
    message.includes('Connection lost') ||
    message.includes('closed')
  );
}

/**
 * Execute a parameterized query against the pool.
 * Automatically retries if the pooled TCP connection was reset.
 * @param {string} sql
 * @param {Array} params
 * @param {number} retries
 * @returns {Promise<[rows, fields]>}
 */
async function query(sql, params = [], retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const [rows, fields] = await pool.query(sql, params);
      return [rows, fields];
    } catch (err) {
      if (isConnectionError(err) && attempt < retries) {
        console.warn(
          `⚠️ MySQL connection error (${err.code || err.message}). Retrying query execution (attempt ${attempt + 1}/${retries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// Store original mysql2 pool.getConnection method
const originalGetConnection = pool.getConnection.bind(pool);

/**
 * Acquire a connection from the pool. Retries automatically if pooled connection was reset.
 * @param {number} retries
 * @returns {Promise<PoolConnection>}
 */
async function getConnection(retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const conn = await originalGetConnection();
      return conn;
    } catch (err) {
      if (isConnectionError(err) && attempt < retries) {
        console.warn(
          `⚠️ MySQL getConnection error (${err.code || err.message}). Retrying (attempt ${attempt + 1}/${retries})...`
        );
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

// Override pool.getConnection to use the retrying getConnection function
pool.getConnection = getConnection;

/**
 * Test the database connection on startup.
 */
async function testConnection() {
  try {
    const [rows] = await query('SELECT 1 AS connected');
    console.log('✅ MySQL connected successfully');
    return true;
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    throw err;
  }
}

module.exports = { pool, query, getConnection, testConnection };

