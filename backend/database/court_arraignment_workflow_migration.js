'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool } = require('../src/config/database');

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
      CREATE TABLE IF NOT EXISTS court_arraignments (
        id INT PRIMARY KEY AUTO_INCREMENT,
        court_case_id INT NOT NULL,
        arraignment_date DATE NOT NULL,
        judge_name VARCHAR(150),
        clerk_name VARCHAR(150),
        defendant_present TINYINT(1) DEFAULT 1,
        plea ENUM('guilty','not_guilty','no_plea') NOT NULL DEFAULT 'no_plea',
        notes TEXT,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_arraignment_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE
      )
    `);

    const indexes = [
      ['idx_court_arraignments_case', 'CREATE INDEX idx_court_arraignments_case ON court_arraignments(court_case_id)'],
      ['idx_court_arraignments_date', 'CREATE INDEX idx_court_arraignments_date ON court_arraignments(arraignment_date)'],
    ];

    for (const [indexName, sql] of indexes) {
      if (!(await indexExists(connection, 'court_arraignments', indexName))) {
        await connection.query(sql);
      }
    }

    await connection.commit();
    console.log('Court arraignment workflow migration completed.');
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
