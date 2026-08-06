'use strict';

require('dotenv').config();
const db = require('../src/config/database');

const tables = ['state_administrations', 'regions', 'cities', 'districts'];

async function run() {
  for (const table of tables) {
    for (const { column, definition } of [
      { column: 'profile_name', definition: 'VARCHAR(150) NULL AFTER password_hash' },
      { column: 'profile_image', definition: 'VARCHAR(500) NULL AFTER profile_name' },
    ]) {
      const [[exists]] = await db.query(
        `SELECT COUNT(*) AS total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      if (!Number(exists.total)) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }
  }
  console.log('Hierarchy profile migration completed.');
  await db.pool.end();
}

run().catch(async (error) => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
