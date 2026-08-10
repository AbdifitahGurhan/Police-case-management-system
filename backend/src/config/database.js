// src/config/database.js — MySQL connection pool using mysql2/promise
'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbUrl = process.env.MYSQL_PRIVATE_URL || process.env.MYSQL_URL || process.env.DATABASE_URL;

const poolConfig = dbUrl
  ? {
      uri: dbUrl,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      connectTimeout: 15000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      dateStrings: ['DATE', 'DATETIME'],
      ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'Mansour2003#',
      database: process.env.DB_NAME || 'police_cms',
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      connectTimeout: 15000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      dateStrings: ['DATE', 'DATETIME'],
    };

const pool = mysql.createPool(poolConfig);

/**
 * Execute a parameterized query against the pool.
 * @param {string} sql
 * @param {Array} params
 * @returns {Promise<[rows, fields]>}
 */
async function query(sql, params = []) {
  const [rows, fields] = await pool.query(sql, params);
  return [rows, fields];
}

/**
 * Test the database connection on startup.
 */
async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1 AS connected');
    console.log('✅ MySQL connected successfully');
    return true;
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    throw err;
  }
}

module.exports = { pool, query, testConnection };
