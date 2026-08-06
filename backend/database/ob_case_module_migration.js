'use strict';
require('dotenv').config();
const db = require('../src/config/database');

async function addColumn(name, definition) {
  const [rows] = await db.query('SHOW COLUMNS FROM ob_entries LIKE ?', [name]);
  if (!rows.length) await db.query(`ALTER TABLE ob_entries ADD COLUMN \`${name}\` ${definition}`);
}

async function run() {
  await addColumn('court_level', "VARCHAR(50) NULL AFTER case_type");
  await addColumn('updated_by', "VARCHAR(100) NULL AFTER registered_by_rank");
  await addColumn('closed_reason', "TEXT NULL AFTER resolution_notes");
  await addColumn('deleted_at', "DATETIME NULL AFTER reopened_at");
  await db.query('ALTER TABLE ob_entries MODIFY status VARCHAR(50) NOT NULL DEFAULT \'REGISTERED\'');
  await db.query('ALTER TABLE ob_entries MODIFY reporter_id_type VARCHAR(50) NULL');

  await db.query(`CREATE TABLE IF NOT EXISTS ob_victims (
    id INT PRIMARY KEY AUTO_INCREMENT, ob_entry_id INT NOT NULL, full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30), details TEXT NOT NULL, address TEXT, created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ob_victim_entry FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id), INDEX idx_ob_victim_entry (ob_entry_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS ob_accused (
    id INT PRIMARY KEY AUTO_INCREMENT, ob_entry_id INT NOT NULL, full_name VARCHAR(150) NOT NULL,
    phone VARCHAR(30), id_type VARCHAR(50), id_number VARCHAR(100), gender VARCHAR(20), address TEXT,
    description TEXT, identifying_information TEXT, custody_state ENUM('IN_CUSTODY','NOT_IN_CUSTODY') NOT NULL DEFAULT 'NOT_IN_CUSTODY',
    status VARCHAR(40) NOT NULL DEFAULT 'WANTED', arrest_date DATETIME, arrest_location VARCHAR(255),
    arresting_officer VARCHAR(150), tracing_sent_at DATETIME, custody_ready TINYINT(1) NOT NULL DEFAULT 0,
    created_by VARCHAR(100), updated_by VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_ob_accused_entry FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id),
    INDEX idx_ob_accused_entry (ob_entry_id), INDEX idx_ob_accused_search (full_name, phone, id_number)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS ob_accused_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT, ob_entry_id INT NOT NULL, accused_id INT NOT NULL,
    previous_status VARCHAR(40), new_status VARCHAR(40) NOT NULL, action VARCHAR(80) NOT NULL,
    notes TEXT, performed_by VARCHAR(100) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ob_ash_entry FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id),
    CONSTRAINT fk_ob_ash_accused FOREIGN KEY (accused_id) REFERENCES ob_accused(id), INDEX idx_ob_ash_accused (accused_id)
  )`);
  await db.query(`CREATE TABLE IF NOT EXISTS ob_status_history (
    id INT PRIMARY KEY AUTO_INCREMENT, ob_entry_id INT NOT NULL, previous_status VARCHAR(50),
    new_status VARCHAR(50) NOT NULL, reason TEXT, performed_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ob_status_entry FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id), INDEX idx_ob_status_entry (ob_entry_id)
  )`);
  console.log('OB case registration module migration completed.');
  await db.pool.end();
}
run().catch(async error => { console.error(error); await db.pool.end(); process.exit(1); });
