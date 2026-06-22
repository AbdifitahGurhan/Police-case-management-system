// src/config/database.js — MySQL connection pool using mysql2/promise
'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'police_cms',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Return dates as strings
  dateStrings: ['DATE', 'DATETIME'],
});

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
