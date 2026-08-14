'use strict';
require('dotenv').config();
const db = require('../src/config/database');

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS case_investigations (
      id INT PRIMARY KEY AUTO_INCREMENT,
      case_id INT NOT NULL,
      investigation_number VARCHAR(50) NOT NULL UNIQUE,
      ob_number VARCHAR(50) NULL,
      investigator_name VARCHAR(150) NULL,
      investigation_date DATE NULL,
      evidence_data JSON NULL,
      witnesses_data JSON NULL,
      steps_data JSON NULL,
      summary TEXT NULL,
      outcome TEXT NULL,
      recommendation TEXT NULL,
      status ENUM('Socota','Dhammaystiran','Xiran') DEFAULT 'Socota',
      created_by VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_investigation_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
    )
  `);
  console.log('Case investigation migration completed.');
}

module.exports = run;

if (require.main === module) {
  run()
    .then(() => db.pool.end())
    .catch(async e => {
      console.error(e.message);
      await db.pool.end();
      process.exit(1);
    });
}
