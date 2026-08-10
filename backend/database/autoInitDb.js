// database/autoInitDb.js - Automatically initializes MySQL tables and seeds data if DB is empty
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function autoInitializeDb() {
  try {
    // 1. Check if tables already exist (e.g. regions table)
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regions'`
    );

    // Always run schema migrations (e.g. assignment_category column)
    const runAssignmentCategoryMigration = require('./add_assignment_category_migration');
    await runAssignmentCategoryMigration();

    if (rows[0] && rows[0].count > 0) {
      return;
    }

    console.log('⚡ Railway / Fresh MySQL Database detected without tables. Initializing Schema and Seeding data...');

    // 2. Read schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      console.warn('⚠️ schema.sql file not found.');
      return;
    }

    let schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Remove DB creation commands to use active Railway DATABASE()
    schemaSql = schemaSql.replace(/DROP DATABASE IF EXISTS [^;]+;/gi, '');
    schemaSql = schemaSql.replace(/CREATE DATABASE IF NOT EXISTS [^;]+;/gi, '');
    schemaSql = schemaSql.replace(/USE [^;]+;/gi, '');

    // Split SQL by semicolon and execute non-empty statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    for (const stmt of statements) {
      try {
        await db.query(stmt);
      } catch (stmtErr) {
        if (!stmtErr.message.includes('already exists')) {
          console.warn('Statement execution notice:', stmtErr.message);
        }
      }
    }
    console.log('✅ Schema tables created successfully.');

    // 3. Run migrations and seed initial data
    console.log('🌱 Seeding initial data (States, Regions, Ranks, Users, Permissions)...');
    delete require.cache[require.resolve('./seed.js')];
    const seed = require('./seed.js');
    if (typeof seed === 'function') {
      await seed();
    }
    console.log('✅ Railway MySQL Database auto-initialization and seeding completed successfully!');
  } catch (err) {
    console.error('❌ Auto DB initialization notice:', err.message);
  }
}

module.exports = autoInitializeDb;
