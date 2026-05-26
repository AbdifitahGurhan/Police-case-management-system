require('dotenv').config({ path: './.env' });
const { pool } = require('./src/config/database');

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await pool.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Added ${table}.${column}`);
  }
}

async function createCustodyTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS biometric_identifiers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      suspect_id INT NOT NULL,
      biometric_type ENUM('fingerprint','face','iris','other') NOT NULL,
      biometric_hash VARCHAR(255) NOT NULL,
      quality_score DECIMAL(5,2),
      captured_by VARCHAR(100),
      captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      CONSTRAINT fk_bio_suspect FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE,
      UNIQUE KEY uq_biometric_type_hash (biometric_type, biometric_hash)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prisoner_documents (
      id INT PRIMARY KEY AUTO_INCREMENT,
      suspect_id INT NOT NULL,
      arrest_id INT,
      document_type VARCHAR(100) NOT NULL,
      title VARCHAR(255) NOT NULL,
      file_url VARCHAR(500),
      file_hash VARCHAR(64),
      uploaded_by VARCHAR(100),
      uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      CONSTRAINT fk_doc_suspect FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE,
      CONSTRAINT fk_doc_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE SET NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prison_transfers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      suspect_id INT NOT NULL,
      arrest_id INT,
      from_facility VARCHAR(255),
      to_facility VARCHAR(255) NOT NULL,
      transfer_reason TEXT NOT NULL,
      transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      authorized_by VARCHAR(100),
      status ENUM('pending','completed','cancelled') DEFAULT 'completed',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_ptr_suspect FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE,
      CONSTRAINT fk_ptr_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE SET NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prisoner_medical_records (
      id INT PRIMARY KEY AUTO_INCREMENT,
      suspect_id INT NOT NULL,
      arrest_id INT,
      record_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      condition_summary TEXT NOT NULL,
      treatment_given TEXT,
      doctor_name VARCHAR(150),
      facility VARCHAR(255),
      fitness_status ENUM('fit','needs_treatment','hospitalized','critical') DEFAULT 'fit',
      recorded_by VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_med_suspect FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE,
      CONSTRAINT fk_med_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE SET NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prisoner_visitor_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      suspect_id INT NOT NULL,
      arrest_id INT,
      visitor_name VARCHAR(150) NOT NULL,
      visitor_id_number VARCHAR(100),
      relationship VARCHAR(100),
      visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      purpose TEXT,
      approved_by VARCHAR(100),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_vis_suspect FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE,
      CONSTRAINT fk_vis_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE SET NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS release_approvals (
      id INT PRIMARY KEY AUTO_INCREMENT,
      suspect_id INT NOT NULL,
      arrest_id INT NOT NULL,
      requested_by VARCHAR(100),
      requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      request_reason TEXT NOT NULL,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      reviewed_by VARCHAR(100),
      reviewed_at TIMESTAMP NULL,
      review_notes TEXT,
      CONSTRAINT fk_rel_suspect FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE,
      CONSTRAINT fk_rel_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE CASCADE
    )
  `);
}

const run = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS special_users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(150) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('ADMIN', 'CID', 'PROSECUTOR', 'COURT', 'JAIL') NOT NULL,
        assigned_unit VARCHAR(255),
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active TINYINT(1) DEFAULT 1
      )
    `);
    await addColumnIfMissing('audit_logs', 'old_data', 'JSON NULL AFTER details');
    await addColumnIfMissing('audit_logs', 'new_data', 'JSON NULL AFTER old_data');
    await addColumnIfMissing('arrests', 'police_station_id', 'INT NULL AFTER suspect_id');
    await addColumnIfMissing('arrests', 'court_decision', "ENUM('pending','convicted','acquitted','dismissed','adjourned') DEFAULT 'pending' AFTER charges");
    await addColumnIfMissing('arrests', 'court_decision_notes', 'TEXT NULL AFTER court_decision');
    await addColumnIfMissing('arrests', 'sentence_period_value', 'INT NULL AFTER court_decision_notes');
    await addColumnIfMissing('arrests', 'sentence_period_unit', "ENUM('days','months','years') NULL AFTER sentence_period_value");
    await addColumnIfMissing('arrests', 'sentence_start_date', 'DATE NULL AFTER sentence_period_unit');
    await addColumnIfMissing('arrests', 'expected_release_date', 'DATE NULL AFTER sentence_start_date');
    await addColumnIfMissing('arrests', 'actual_release_date', 'DATE NULL AFTER expected_release_date');
    await addColumnIfMissing('arrests', 'sentence_status', "ENUM('awaiting_trial','sentenced','serving','release_review','completed','released','wanted','escaped','acquitted','dismissed') DEFAULT 'awaiting_trial' AFTER actual_release_date");
    await addColumnIfMissing('arrests', 'final_status', 'VARCHAR(100) NULL AFTER sentence_status');
    await createCustodyTables();
    console.log("Migration successful");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
