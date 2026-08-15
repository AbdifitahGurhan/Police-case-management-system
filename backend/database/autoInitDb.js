// database/autoInitDb.js - Automatically initializes MySQL tables and seeds data if DB is empty
'use strict';

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function runMigrations() {
  const runObRegistrationMigration = require('./ob_registration_migration');
  await runObRegistrationMigration();
  const runAssignmentCategoryMigration = require('./add_assignment_category_migration');
  await runAssignmentCategoryMigration();
  const runCaseInvestigationMigration = require('./case_investigation_migration');
  await runCaseInvestigationMigration();
  const { migrate: runCourtRemandMigration } = require('./court_workflow_remand_migration');
  await runCourtRemandMigration();
  const { migrate: runCourtArraignmentMigration } = require('./court_arraignment_workflow_migration');
  await runCourtArraignmentMigration();
  const runRemoveCitiesMigration = require('./remove_cities_migration');
  await runRemoveCitiesMigration();
  const runStateAdminUsersManageMigration = require('./state_admin_users_manage_migration');
  await runStateAdminUsersManageMigration();
}

async function autoInitializeDb() {
  try {
    // 1. Check if tables already exist (e.g. regions table)
    const [rows] = await db.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'regions'`
    );

    if (rows[0] && rows[0].count > 0) {
      await runMigrations();
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

    await runMigrations();

    // 3. Run migrations and seed initial data
    console.log('🌱 Seeding initial data (States, Regions, Ranks, Users, Permissions)...');
    delete require.cache[require.resolve('./seed.js')];
    const seed = require('./seed.js');
    if (typeof seed === 'function') {
      await seed();
    }
    console.log('✅ Railway MySQL Database auto-initialization and seeding completed successfully!');
  } catch (err) {
    console.error('Auto DB initialization failed:', err.message);
    throw err;
  }
}

module.exports = autoInitializeDb;
