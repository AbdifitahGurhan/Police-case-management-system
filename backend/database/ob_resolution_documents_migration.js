'use strict';
require('dotenv').config();
const db=require('../src/config/database');
async function run(){
  await db.query(`ALTER TABLE ob_entries MODIFY status ENUM('OB_REGISTERED','FORWARDED_FOR_REVIEW','CONVERTED_TO_CASE','CASE_OPENED','CLOSED','RESOLVED_BY_RECONCILIATION','WARNING_ISSUED','MEDIATION_COMPLETED','COMPLAINT_WITHDRAWN','FALSE_REPORT_CORRECTED','GENERAL_AGREEMENT_COMPLETED') DEFAULT 'OB_REGISTERED'`);
  await db.query(`ALTER TABLE ob_entries MODIFY resolution_method ENUM('reconciliation','warning','mediation','withdrawal','false_report','general_agreement','agreement','withdrawn','other') NULL`);
  await db.query(`CREATE TABLE IF NOT EXISTS ob_resolution_documents (
    id INT PRIMARY KEY AUTO_INCREMENT, ob_entry_id INT NOT NULL,
    document_type ENUM('reconciliation','warning','mediation','withdrawal','false_report','general_agreement') NOT NULL,
    document_title VARCHAR(255) NOT NULL, document_data JSON NOT NULL, official_html LONGTEXT NOT NULL,
    created_by VARCHAR(100) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ob_resolution_document FOREIGN KEY(ob_entry_id) REFERENCES ob_entries(id) ON DELETE CASCADE,
    INDEX idx_ob_resolution_document(ob_entry_id,created_at)
  )`);
  console.log('OB resolution documents migration completed.'); await db.pool.end();
}
run().catch(async e=>{console.error(e.message);await db.pool.end();process.exit(1)});
