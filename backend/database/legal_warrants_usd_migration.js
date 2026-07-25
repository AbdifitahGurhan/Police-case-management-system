'use strict';

require('dotenv').config();
const db = require('../src/config/database');

const statements = [
  `CREATE TABLE IF NOT EXISTS legal_personnel (
    id INT PRIMARY KEY AUTO_INCREMENT,
    personnel_type ENUM('judge','prosecutor') NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    identification_number VARCHAR(100) NOT NULL UNIQUE,
    phone_number VARCHAR(30),
    email VARCHAR(150),
    court_or_office VARCHAR(200) NOT NULL,
    position VARCHAR(120) NOT NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_legal_personnel_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_legal_personnel_type_status (personnel_type, status)
  )`,
  `ALTER TABLE ob_entries MODIFY claim_value DECIMAL(15,2) NULL`,
  `ALTER TABLE cases ADD COLUMN IF NOT EXISTS claim_value DECIMAL(15,2) NULL AFTER priority`,
  `ALTER TABLE court_cases ADD COLUMN IF NOT EXISTS assigned_judge_id INT NULL AFTER assigned_judge`,
  `ALTER TABLE court_cases ADD COLUMN IF NOT EXISTS assigned_prosecutor_id INT NULL AFTER assigned_prosecutor`,
  `ALTER TABLE court_hearings ADD COLUMN IF NOT EXISTS assigned_judge_id INT NULL AFTER assigned_judge`,
  `ALTER TABLE court_judgments ADD COLUMN IF NOT EXISTS judge_id INT NULL AFTER judge_name`,
  `ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS police_station_id INT NULL AFTER entity_id`,
  `CREATE TABLE IF NOT EXISTS warrants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    warrant_number VARCHAR(80) NOT NULL UNIQUE,
    warrant_type ENUM('arrest','search','court_summons','detention','other_court_order') NOT NULL,
    case_id INT NULL,
    ob_entry_id INT NULL,
    criminal_id INT NULL,
    subject_name VARCHAR(150) NOT NULL,
    reason TEXT NOT NULL,
    issued_by_judge_id INT NULL,
    requested_by_prosecutor_id INT NULL,
    requested_by_officer_id INT NULL,
    police_station_id INT NOT NULL,
    issue_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    status ENUM('draft','pending','issued','executed','expired','cancelled') NOT NULL DEFAULT 'draft',
    execution_date DATE NULL,
    execution_notes TEXT NULL,
    attachment_url VARCHAR(500) NULL,
    cancellation_reason TEXT NULL,
    cancelled_at DATETIME NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_warrant_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE RESTRICT,
    CONSTRAINT fk_warrant_ob FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id) ON DELETE RESTRICT,
    CONSTRAINT fk_warrant_criminal FOREIGN KEY (criminal_id) REFERENCES criminals(id) ON DELETE SET NULL,
    CONSTRAINT fk_warrant_judge FOREIGN KEY (issued_by_judge_id) REFERENCES legal_personnel(id) ON DELETE RESTRICT,
    CONSTRAINT fk_warrant_prosecutor FOREIGN KEY (requested_by_prosecutor_id) REFERENCES legal_personnel(id) ON DELETE SET NULL,
    CONSTRAINT fk_warrant_officer FOREIGN KEY (requested_by_officer_id) REFERENCES police_officers(id) ON DELETE SET NULL,
    CONSTRAINT fk_warrant_station FOREIGN KEY (police_station_id) REFERENCES districts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_warrant_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_warrant_filters (status, warrant_type, police_station_id, issue_date),
    INDEX idx_warrant_case (case_id),
    INDEX idx_warrant_ob (ob_entry_id)
  )`,
];

async function run() {
  for (const sql of statements) await db.query(sql);
  console.log('Legal personnel, USD, and warrants migration completed.');
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
