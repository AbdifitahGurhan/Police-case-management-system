'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/config/database');

const columnExists = async (connection, table, column) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) count FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, column]
  );
  return Number(row.count) > 0;
};

const indexExists = async (connection, table, index) => {
  const [[row]] = await connection.query(
    `SELECT COUNT(*) count FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
    [table, index]
  );
  return Number(row.count) > 0;
};

async function migrate() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS case_workflow_authorizations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        case_id INT NOT NULL,
        authorization_type ENUM('reopen_case') NOT NULL,
        reason TEXT NOT NULL,
        status ENUM('pending','approved','rejected','consumed') DEFAULT 'pending',
        authorized_by VARCHAR(100),
        authorized_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_workflow_auth_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
        INDEX idx_workflow_auth_case_status (case_id, authorization_type, status)
      )
    `);

    if (!(await columnExists(connection, 'court_sentences', 'criminal_id'))) {
      await connection.query('ALTER TABLE court_sentences ADD COLUMN criminal_id INT NULL AFTER court_case_id');
    }
    if (await columnExists(connection, 'court_sentences', 'suspect_id')) {
      await connection.query('UPDATE court_sentences SET criminal_id = COALESCE(criminal_id, suspect_id)');
    }
    if (!(await indexExists(connection, 'court_sentences', 'fk_sent_criminal'))) {
      await connection.query(
        'ALTER TABLE court_sentences ADD CONSTRAINT fk_sent_criminal FOREIGN KEY (criminal_id) REFERENCES criminals(id)'
      );
    }
    if (!(await indexExists(connection, 'court_cases', 'uq_court_case_police_case'))) {
      const [duplicates] = await connection.query(
        'SELECT police_case_id FROM court_cases GROUP BY police_case_id HAVING COUNT(*) > 1'
      );
      if (duplicates.length) {
        throw new Error('Duplicate court_cases exist. Repair them before adding uq_court_case_police_case.');
      }
      await connection.query('ALTER TABLE court_cases ADD UNIQUE KEY uq_court_case_police_case (police_case_id)');
    }
    await connection.commit();
    console.log('Workflow integrity migration completed.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

if (require.main === module) {
  migrate().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { migrate };
