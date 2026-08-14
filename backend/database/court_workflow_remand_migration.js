'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/config/database');

const COURT_STATUS_ENUM = `
  ENUM(
    'registered',
    'awaiting_hearing',
    'hearing_scheduled',
    'in_trial',
    'judgment_issued',
    'court_received',
    'arraignment',
    'remand_investigation',
    'remanded_to_investigator',
    'returned_from_remand',
    'assigned_legal_team',
    'case_scheduled',
    'trial_hearing',
    'evidence_defense',
    'judgment',
    'sentenced',
    'appealed',
    'closed',
    'archived'
  )
`;

const FINAL_COURT_STATUS_ENUM = `
  ENUM(
    'court_received',
    'arraignment',
    'remand_investigation',
    'remanded_to_investigator',
    'returned_from_remand',
    'assigned_legal_team',
    'case_scheduled',
    'trial_hearing',
    'evidence_defense',
    'judgment',
    'sentenced',
    'appealed',
    'closed',
    'archived'
  )
`;

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

    await connection.query(`ALTER TABLE court_cases MODIFY status ${COURT_STATUS_ENUM} DEFAULT 'court_received'`);

    await connection.query("UPDATE court_cases SET status = 'court_received' WHERE status = 'registered'");
    await connection.query("UPDATE court_cases SET status = 'assigned_legal_team' WHERE status = 'awaiting_hearing'");
    await connection.query("UPDATE court_cases SET status = 'case_scheduled' WHERE status = 'hearing_scheduled'");
    await connection.query("UPDATE court_cases SET status = 'trial_hearing' WHERE status = 'in_trial'");
    await connection.query("UPDATE court_cases SET status = 'judgment' WHERE status = 'judgment_issued'");

    await connection.query(`ALTER TABLE court_cases MODIFY status ${FINAL_COURT_STATUS_ENUM} DEFAULT 'court_received'`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS court_remands (
        id INT PRIMARY KEY AUTO_INCREMENT,
        court_case_id INT NOT NULL,
        police_case_id INT NOT NULL,
        sent_to_user_id INT NULL,
        sent_to_role VARCHAR(50) NULL,
        sent_to_station_id INT NULL,
        reason VARCHAR(255) NULL,
        instructions TEXT NOT NULL,
        deadline_date DATE NULL,
        status ENUM('pending','returned','completed','cancelled') DEFAULT 'pending',
        sent_by VARCHAR(100),
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        returned_by VARCHAR(100) NULL,
        returned_at TIMESTAMP NULL,
        return_notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_remand_court_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE,
        CONSTRAINT fk_remand_police_case FOREIGN KEY (police_case_id) REFERENCES cases(id) ON DELETE CASCADE,
        CONSTRAINT fk_remand_user FOREIGN KEY (sent_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_remand_station FOREIGN KEY (sent_to_station_id) REFERENCES districts(id) ON DELETE SET NULL
      )
    `);

    const indexes = [
      ['idx_court_remands_court_case', 'CREATE INDEX idx_court_remands_court_case ON court_remands(court_case_id)'],
      ['idx_court_remands_police_case', 'CREATE INDEX idx_court_remands_police_case ON court_remands(police_case_id)'],
      ['idx_court_remands_status', 'CREATE INDEX idx_court_remands_status ON court_remands(status)'],
      ['idx_court_remands_sent_to_user', 'CREATE INDEX idx_court_remands_sent_to_user ON court_remands(sent_to_user_id)'],
      ['idx_court_remands_station', 'CREATE INDEX idx_court_remands_station ON court_remands(sent_to_station_id)'],
    ];

    for (const [indexName, sql] of indexes) {
      if (!(await indexExists(connection, 'court_remands', indexName))) {
        await connection.query(sql);
      }
    }

    await connection.commit();
    console.log('Court workflow and remand migration completed.');
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

if (require.main === module) {
  migrate()
    .then(() => pool.end())
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exitCode = 1;
    });
}

module.exports = { migrate };
