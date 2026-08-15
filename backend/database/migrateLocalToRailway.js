// database/migrateLocalToRailway.js - Migrates local MySQL data to Railway MySQL.
'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

function getRailwayUrl() {
  return process.env.MYSQL_PRIVATE_URL
    || process.env.MYSQL_URL
    || process.env.DATABASE_URL
    || process.env.RAILWAY_MYSQL_URL;
}

function getLocalConfig() {
  return {
    host: process.env.LOCAL_DB_HOST || process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.LOCAL_DB_PORT || process.env.DB_PORT || '3306', 10),
    user: process.env.LOCAL_DB_USER || process.env.DB_USER || 'root',
    password: process.env.LOCAL_DB_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.LOCAL_DB_NAME || process.env.DB_NAME || 'police_cms',
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    dateStrings: ['DATE', 'DATETIME'],
  };
}

function validateRailwayUrl(railwayUrl) {
  if (!railwayUrl) {
    throw new Error(
      'Missing Railway MySQL URL. Set MYSQL_PRIVATE_URL, MYSQL_URL, DATABASE_URL, or RAILWAY_MYSQL_URL.'
    );
  }

  if (/localhost|127\.0\.0\.1/i.test(railwayUrl)) {
    throw new Error('Railway MySQL URL points to localhost/127.0.0.1. Refusing to migrate.');
  }
}

function requireConfirmedDrop() {
  if (!process.argv.includes('--confirm-drop')) {
    throw new Error(
      'This migration recreates Railway tables and can overwrite data. Re-run with --confirm-drop to continue.'
    );
  }
}

async function getTableNames(pool) {
  const [tables] = await pool.query('SHOW TABLES');
  return tables.map((tableObj) => Object.values(tableObj)[0]);
}

function normalizeRowValue(value) {
  if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function insertRows(railwayPool, tableName, rows) {
  if (rows.length === 0) {
    console.log(`  ${tableName}: 0 rows.`);
    return;
  }

  let insertedCount = 0;
  const batchSize = 50;
  const keys = Object.keys(rows[0]);
  const cols = keys.map((key) => `\`${key}\``).join(', ');

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const valuesList = [];
    const placeholdersList = [];

    for (const row of chunk) {
      valuesList.push(...keys.map((key) => normalizeRowValue(row[key])));
      placeholdersList.push(`(${keys.map(() => '?').join(', ')})`);
    }

    try {
      await railwayPool.query(
        `INSERT INTO \`${tableName}\` (${cols}) VALUES ${placeholdersList.join(', ')}`,
        valuesList
      );
      insertedCount += chunk.length;
    } catch (batchErr) {
      for (const row of chunk) {
        try {
          await railwayPool.query(
            `INSERT INTO \`${tableName}\` (${cols}) VALUES (${keys.map(() => '?').join(', ')})`,
            keys.map((key) => normalizeRowValue(row[key]))
          );
          insertedCount++;
        } catch (rowErr) {
          console.warn(`Skipped row in ${tableName}: ${rowErr.message}`);
        }
      }
    }
  }

  console.log(`  ${tableName}: ${insertedCount}/${rows.length} rows migrated.`);
}

async function migrateLocalToRailway() {
  const railwayUrl = getRailwayUrl();
  validateRailwayUrl(railwayUrl);
  requireConfirmedDrop();

  console.log('Connecting to local MySQL pool...');
  const localPool = mysql.createPool(getLocalConfig());

  console.log('Connecting to Railway MySQL pool from environment URL...');
  const railwayPool = mysql.createPool({
    uri: railwayUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 15000,
    enableKeepAlive: true,
    dateStrings: ['DATE', 'DATETIME'],
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
  });

  try {
    const tableNames = await getTableNames(localPool);
    console.log(`Found ${tableNames.length} tables in local database.`);

    await railwayPool.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const tableName of tableNames) {
      const [[createSql]] = await localPool.query(`SHOW CREATE TABLE \`${tableName}\``);
      await railwayPool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      await railwayPool.query(createSql['Create Table']);

      const [rows] = await localPool.query(`SELECT * FROM \`${tableName}\``);
      await insertRows(railwayPool, tableName, rows);
    }

    await railwayPool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('All tables and local data migrated to Railway.');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  } finally {
    await localPool.end();
    await railwayPool.end();
  }
}

module.exports = migrateLocalToRailway;

if (require.main === module) {
  migrateLocalToRailway().catch(() => {
    process.exit(1);
  });
}
