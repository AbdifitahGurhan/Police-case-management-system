'use strict';

const db = require('../src/config/database');

async function tableExists(tableName) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return Number(row.total) > 0;
}

async function columnExists(tableName, columnName) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return Number(row.total) > 0;
}

async function constraintExists(tableName, constraintName) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return Number(row.total) > 0;
}

async function indexExists(tableName, indexName) {
  const [[row]] = await db.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return Number(row.total) > 0;
}

async function dropForeignKeyIfExists(tableName, constraintName) {
  if (await constraintExists(tableName, constraintName)) {
    await db.query(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${constraintName}\``);
  }
}

async function dropColumnIfExists(tableName, columnName) {
  if (await columnExists(tableName, columnName)) {
    await db.query(`ALTER TABLE \`${tableName}\` DROP COLUMN \`${columnName}\``);
  }
}

async function migrate() {
  console.log('Starting cities removal migration...');

  if (!(await tableExists('districts'))) {
    console.log('Cities removal migration skipped: districts table missing.');
    return;
  }

  if (!(await columnExists('districts', 'region_id'))) {
    await db.query('ALTER TABLE districts ADD COLUMN region_id INT NULL AFTER id');
  }

  if ((await tableExists('cities')) && (await columnExists('districts', 'city_id'))) {
    await db.query(`
      UPDATE districts d
      JOIN cities c ON c.id = d.city_id
      SET d.region_id = c.region_id
      WHERE d.region_id IS NULL
    `);
  }

  if (await tableExists('cases')) {
    if (await columnExists('cases', 'district_id')) {
      await db.query(`
        UPDATE cases c
        JOIN districts d ON d.id = c.district_id
        JOIN regions r ON r.id = d.region_id
        SET c.region_id = COALESCE(c.region_id, d.region_id),
            c.state_administration_id = COALESCE(c.state_administration_id, r.state_administration_id)
        WHERE c.district_id IS NOT NULL
      `);
    }
    await dropForeignKeyIfExists('cases', 'fk_case_city');
    await dropColumnIfExists('cases', 'city_id');
  }

  if (await tableExists('case_transfers')) {
    await dropColumnIfExists('case_transfers', 'from_city_id');
    await dropColumnIfExists('case_transfers', 'to_city_id');
  }

  if ((await tableExists('users')) && (await tableExists('roles'))) {
    await db.query(`
      DELETE u
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE LOWER(r.name) = 'city_admin'
    `);
    await db.query("DELETE FROM roles WHERE LOWER(name) = 'city_admin'");
  }

  if (await indexExists('districts', 'idx_district_region')) {
    // Already indexed.
  } else {
    await db.query('ALTER TABLE districts ADD INDEX idx_district_region (region_id)');
  }

  await dropForeignKeyIfExists('districts', 'fk_district_city');
  await dropColumnIfExists('districts', 'city_id');

  if (!(await constraintExists('districts', 'fk_district_region'))) {
    await db.query(`
      ALTER TABLE districts
      ADD CONSTRAINT fk_district_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE
    `);
  }

  if (await tableExists('cities')) {
    await db.query('DROP TABLE cities');
  }

  console.log('Cities removal migration completed.');
}

if (require.main === module) {
  migrate()
    .then(async () => {
      await db.pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await db.pool.end();
      process.exit(1);
    });
}

module.exports = migrate;
