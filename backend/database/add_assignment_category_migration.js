// database/add_assignment_category_migration.js — Migration for officer_assignments category & business logic rules
'use strict';

const db = require('../src/config/database');

async function runMigration() {
  try {
    console.log('🔄 Checking officer_assignments schema...');

    // 1. Check if assignment_category column exists
    const [cols] = await db.query(
      `SELECT COUNT(*) AS count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'officer_assignments' AND COLUMN_NAME = 'assignment_category'`
    );

    if (cols[0].count === 0) {
      console.log('➕ Adding assignment_category column to officer_assignments...');
      await db.query(
        `ALTER TABLE officer_assignments
         ADD COLUMN assignment_category ENUM('ADMIN', 'OPERATIONAL', 'SUPPORT') DEFAULT 'OPERATIONAL' AFTER assignment_id`
      );
      console.log('✅ assignment_category column added successfully.');
    } else {
      console.log('ℹ️ assignment_category column already exists.');
    }

    // 2. Backfill assignment_category for existing records based on assignment_type
    console.log('🔄 Backfilling assignment_category for existing assignments...');
    await db.query(`
      UPDATE officer_assignments
      SET assignment_category = 'ADMIN'
      WHERE assignment_type IN ('State Administration', 'Region', 'District', 'Sub-Admin')
        AND (assignment_category IS NULL OR assignment_category = 'OPERATIONAL')
    `);

    await db.query(`
      UPDATE officer_assignments
      SET assignment_category = 'OPERATIONAL'
      WHERE assignment_type IN ('District Station', 'District User Link', 'Region Unit', 'State Unit')
        AND (assignment_category IS NULL OR assignment_category = 'ADMIN')
    `);

    console.log('✅ Existing officer_assignments categorized successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  }
}

module.exports = runMigration;

if (require.main === module) {
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}
