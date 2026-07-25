'use strict';
require('dotenv').config();
const db = require('../src/config/database');

async function add(name, definition) {
  const [rows] = await db.query(`SHOW COLUMNS FROM cases LIKE ?`, [name]);
  if (!rows.length) await db.query(`ALTER TABLE cases ADD COLUMN \`${name}\` ${definition}`);
}

async function run() {
  await add('complainant_id_type', "ENUM('National ID','Passport') NULL AFTER complainant_phone");
  await add('complainant_id_number', 'VARCHAR(100) NULL AFTER complainant_id_type');
  await add('complainant_email', 'VARCHAR(150) NULL AFTER complainant_id_number');
  await add('complainant_address', 'VARCHAR(255) NULL AFTER complainant_email');
  await add('claim_value', 'DECIMAL(15,2) NULL AFTER priority');
  await add('case_level', "ENUM('normal','urgent','critical') DEFAULT 'normal' AFTER case_type");
  console.log('Case registration migration completed.');
  await db.pool.end();
}
run().catch(async error => { console.error(error.message); await db.pool.end(); process.exit(1); });
