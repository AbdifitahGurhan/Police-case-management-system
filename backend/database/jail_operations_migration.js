'use strict';

require('dotenv').config();
const db = require('../src/config/database');

const statements = [
  `CREATE TABLE IF NOT EXISTS prison_cells (
    id INT PRIMARY KEY AUTO_INCREMENT, facility VARCHAR(150) NOT NULL, block_name VARCHAR(50) NOT NULL,
    cell_number VARCHAR(50) NOT NULL, capacity INT NOT NULL DEFAULT 4, is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_prison_cell (facility, block_name, cell_number)
  )`,
  `CREATE TABLE IF NOT EXISTS prison_admissions (
    id INT PRIMARY KEY AUTO_INCREMENT, arrest_id INT NOT NULL, suspect_id INT NOT NULL,
    prison_number VARCHAR(50) NOT NULL UNIQUE, facility VARCHAR(150) NOT NULL,
    admission_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status ENUM('admitted','discharged') DEFAULT 'admitted', admitted_by VARCHAR(100), notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_active_arrest_admission (arrest_id),
    CONSTRAINT fk_admission_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE CASCADE,
    CONSTRAINT fk_admission_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS prison_cell_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT, admission_id INT NOT NULL, facility VARCHAR(150) NOT NULL,
    block_name VARCHAR(50) NOT NULL, cell_number VARCHAR(50) NOT NULL,
    assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, released_at DATETIME NULL,
    assigned_by VARCHAR(100), notes TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_cell_assignment_admission FOREIGN KEY (admission_id) REFERENCES prison_admissions(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS prison_roll_calls (
    id INT PRIMARY KEY AUTO_INCREMENT, admission_id INT NOT NULL, roll_date DATE NOT NULL,
    shift ENUM('morning','afternoon','night') NOT NULL,
    status ENUM('present','absent','hospital','court','transfer') NOT NULL DEFAULT 'present',
    notes TEXT, recorded_by VARCHAR(100), recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_admission_roll_call (admission_id, roll_date, shift),
    CONSTRAINT fk_roll_call_admission FOREIGN KEY (admission_id) REFERENCES prison_admissions(id) ON DELETE CASCADE
  )`,
];

const admissionColumns = [
  ['photo_url', 'VARCHAR(500) NULL'],
  ['commitment_warrant_url', 'VARCHAR(500) NULL'],
  ['property_inventory', 'JSON NULL'],
  ['confirmed_at', 'DATETIME NULL'],
];

async function run() {
  for (const statement of statements) await db.query(statement);
  for (const block of ['Block A', 'Block B', 'Block C', 'Block D']) {
    for (let number = 1; number <= 20; number += 1) {
      await db.query(
        `INSERT IGNORE INTO prison_cells (facility, block_name, cell_number, capacity) VALUES (?, ?, ?, 4)`,
        ['Mogadishu Central Jail', block, String(number).padStart(2, '0')]
      );
    }
  }
  for (const [column, definition] of admissionColumns) {
    const [[exists]] = await db.query(
      `SELECT COUNT(*) AS total FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'prison_admissions' AND COLUMN_NAME = ?`,
      [column]
    );
    if (!Number(exists.total)) await db.query(`ALTER TABLE prison_admissions ADD COLUMN ${column} ${definition}`);
  }
  console.log('Jail operations migration completed.');
  await db.pool.end();
}

run().catch(async (error) => {
  console.error(error.message);
  await db.pool.end();
  process.exit(1);
});
