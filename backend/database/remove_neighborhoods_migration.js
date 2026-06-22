// database/remove_neighborhoods_migration.js
'use strict';

const db = require('../src/config/database');

async function tableExists(tableName) {
  const [rows] = await db.query(
    "SHOW TABLES LIKE ?",
    [tableName]
  );
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].count > 0;
}

async function constraintExists(tableName, constraintName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return rows[0].count > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return rows[0].count > 0;
}

async function migrate() {
  console.log('🚀 Starting Neighborhoods removal migration...');
  
  try {
    // 1. Update arrests data: point police_station_id from neighborhood to its parent district
    if (await tableExists('neighborhoods') && await columnExists('arrests', 'police_station_id')) {
      console.log('Mapping arrests.police_station_id to district_id...');
      await db.query(`
        UPDATE arrests a
        JOIN neighborhoods n ON a.police_station_id = n.id
        SET a.police_station_id = n.district_id
      `);
    }

    // 2. Drop foreign keys referencing neighborhoods
    if (await constraintExists('cases', 'fk_case_neighborhood')) {
      console.log('Dropping fk_case_neighborhood foreign key...');
      await db.query('ALTER TABLE cases DROP FOREIGN KEY fk_case_neighborhood');
    }
    if (await constraintExists('ob_entries', 'fk_ob_waax')) {
      console.log('Dropping fk_ob_waax foreign key...');
      await db.query('ALTER TABLE ob_entries DROP FOREIGN KEY fk_ob_waax');
    }
    if (await constraintExists('arrests', 'fk_ar_station')) {
      console.log('Dropping fk_ar_station foreign key...');
      await db.query('ALTER TABLE arrests DROP FOREIGN KEY fk_ar_station');
    }

    // 3. Drop neighborhood columns
    if (await columnExists('users', 'neighborhood_id')) {
      console.log('Dropping users.neighborhood_id column...');
      if (await indexExists('users', 'idx_users_location')) {
        await db.query('ALTER TABLE users DROP INDEX idx_users_location');
      }
      await db.query('ALTER TABLE users DROP COLUMN neighborhood_id');
      console.log('Recreating idx_users_location without neighborhood_id...');
      await db.query('ALTER TABLE users ADD INDEX idx_users_location (state_administration_id, region_id, district_id)');
    }

    if (await columnExists('cases', 'neighborhood_id')) {
      console.log('Dropping cases.neighborhood_id column...');
      await db.query('ALTER TABLE cases DROP COLUMN neighborhood_id');
    }

    if (await columnExists('ob_entries', 'neighborhood_id')) {
      console.log('Dropping ob_entries.neighborhood_id column and adjusting index...');
      // Create new index first to satisfy foreign keys
      await db.query('ALTER TABLE ob_entries ADD INDEX idx_ob_location_new (state_administration_id, region_id, district_id)');
      if (await indexExists('ob_entries', 'idx_ob_location')) {
        await db.query('ALTER TABLE ob_entries DROP INDEX idx_ob_location');
      }
      await db.query('ALTER TABLE ob_entries DROP COLUMN neighborhood_id');
      await db.query('ALTER TABLE ob_entries RENAME INDEX idx_ob_location_new TO idx_ob_location');
      console.log('Adjusted ob_entries index successfully.');
    }

    if (await columnExists('case_transfers', 'from_neighborhood_id')) {
      console.log('Dropping case_transfers.from_neighborhood_id column...');
      await db.query('ALTER TABLE case_transfers DROP COLUMN from_neighborhood_id');
    }
    if (await columnExists('case_transfers', 'to_neighborhood_id')) {
      console.log('Dropping case_transfers.to_neighborhood_id column...');
      await db.query('ALTER TABLE case_transfers DROP COLUMN to_neighborhood_id');
    }

    // 4. Re-link arrests.police_station_id to districts table
    if (await columnExists('arrests', 'police_station_id')) {
      console.log('Adding new fk_ar_station foreign key referencing districts...');
      await db.query(`
        ALTER TABLE arrests
        ADD CONSTRAINT fk_ar_station FOREIGN KEY (police_station_id) REFERENCES districts(id) ON DELETE SET NULL
      `);
    }

    // 5. Delete roles and associated users
    console.log('Deleting users with neighborhood_admin/WAAX_COMMANDER roles...');
    await db.query(`
      DELETE FROM users 
      WHERE role_id IN (SELECT id FROM roles WHERE name IN ('WAAX_COMMANDER', 'neighborhood_admin'))
    `);
    
    console.log('Deleting roles WAAX_COMMANDER and neighborhood_admin...');
    await db.query(`
      DELETE FROM roles 
      WHERE name IN ('WAAX_COMMANDER', 'neighborhood_admin')
    `);

    // 6. Drop neighborhoods table
    if (await tableExists('neighborhoods')) {
      console.log('Dropping neighborhoods table...');
      await db.query('DROP TABLE IF EXISTS neighborhoods');
    }

    console.log('✅ Neighborhoods removal migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
