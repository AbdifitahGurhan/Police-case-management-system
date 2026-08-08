// src/config/database.js — MySQL connection pool using mysql2/promise
'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

const dbUrl = process.env.MYSQL_PRIVATE_URL || process.env.MYSQL_URL || process.env.DATABASE_URL;

const pool = dbUrl
  ? mysql.createPool({
      uri: dbUrl,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      dateStrings: ['DATE', 'DATETIME'],
    })
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'fnwEEUNFXuhIXbuAhjwwwZonCsVKUdjU',
      database: process.env.DB_NAME || 'railway' || 'police_cms',
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
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
