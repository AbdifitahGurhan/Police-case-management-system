'use strict';
require('dotenv').config();
const db = require('../src/config/database');
async function add(name, definition) { const [rows] = await db.query('SHOW COLUMNS FROM ob_entries LIKE ?', [name]); if (!rows.length) await db.query(`ALTER TABLE ob_entries ADD COLUMN \`${name}\` ${definition}`); }
async function migrate() {
  await add('case_title','VARCHAR(255) NULL AFTER ob_number'); await add('case_type','VARCHAR(100) NULL AFTER case_title');
  await add('case_level',"ENUM('normal','urgent','critical') DEFAULT 'normal' AFTER case_type");
  await add('reporter_id_type',"ENUM('National ID','Passport') NULL AFTER reporter_phone"); await add('reporter_id_number','VARCHAR(100) NULL AFTER reporter_id_type');
  await add('reporter_gender','VARCHAR(30) NULL AFTER reporter_phone');
  await add('reporter_email','VARCHAR(150) NULL AFTER reporter_id_number'); await add('reporter_address','VARCHAR(255) NULL AFTER reporter_email');
  await add('respondent_name','VARCHAR(150) NULL AFTER reporter_address'); await add('respondent_id_type',"ENUM('National ID','Passport') NULL AFTER respondent_name");
  await add('respondent_id_number','VARCHAR(100) NULL AFTER respondent_id_type'); await add('respondent_phone','VARCHAR(30) NULL AFTER respondent_id_number'); await add('respondent_email','VARCHAR(150) NULL AFTER respondent_phone'); await add('respondent_address','VARCHAR(255) NULL AFTER respondent_email');
  await add('incident_datetime','DATETIME NULL AFTER incident_location'); await add('claim_value','DECIMAL(15,2) NULL AFTER incident_datetime');
  await db.query(`CREATE TABLE IF NOT EXISTS ob_attachments (id INT PRIMARY KEY AUTO_INCREMENT,ob_entry_id INT NOT NULL,file_name VARCHAR(255) NOT NULL,file_url VARCHAR(500) NOT NULL,mime_type VARCHAR(100),file_size BIGINT,uploaded_by VARCHAR(100),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_ob_attachment FOREIGN KEY(ob_entry_id) REFERENCES ob_entries(id) ON DELETE CASCADE)`);
  console.log('OB registration migration completed.');
}

if (require.main === module) {
  migrate()
    .then(() => db.pool.end())
    .catch(async e=>{console.error(e.message);await db.pool.end();process.exit(1)});
}

module.exports = migrate;
