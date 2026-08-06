'use strict';

require('dotenv').config();
const db = require('../src/config/database');

// Transactional/operational records only. Identity, access, geography, ranks,
// police officers, legal personnel and configured prison cells are preserved.
const TABLES = [
  'court_evidence_notes', 'court_witnesses', 'court_appeals', 'court_sentences',
  'court_judgments', 'court_proceedings', 'court_hearings', 'court_cases',
  'prison_roll_calls', 'prison_cell_assignments', 'prison_admissions',
  'prisoner_documents', 'prisoner_medical_records', 'prisoner_visitor_logs',
  'release_approvals', 'prison_transfers', 'chain_of_custody', 'evidence',
  'arrests', 'biometric_identifiers', 'cid_reports', 'cid_crime_scenes',
  'cid_progress_notes', 'cid_cases', 'referrals', 'case_actions',
  'case_workflow_authorizations', 'case_confirmations', 'case_transfers',
  'case_criminals', 'case_victims', 'witness_statements', 'cases',
  'ob_accused_status_history', 'ob_status_history', 'ob_resolution_documents',
  'ob_attachments', 'ob_accused', 'ob_victims', 'ob_entries',
  'district_complaints', 'warrants', 'blockchain_records', 'audit_logs',
  'login_logs', 'officer_attendance', 'officer_transfers',
  'complainants', 'criminals', 'victims', 'witnesses',
];

async function run() {
  const connection = await db.pool.getConnection();
  try {
    const [existingRows] = await connection.query('SHOW TABLES');
    const existing = new Set(existingRows.map(row => Object.values(row)[0]));
    const targets = TABLES.filter(table => existing.has(table));
    const before = {};
    for (const table of targets) {
      const [[row]] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
      before[table] = Number(row.count);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    await connection.beginTransaction();
    try {
      for (const table of targets) await connection.query(`DELETE FROM \`${table}\``);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS=1');
    }

    for (const table of targets) await connection.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT=1`);
    const removed = Object.values(before).reduce((sum, count) => sum + count, 0);
    console.log(`Operational database reset completed. ${removed} records removed from ${targets.length} tables.`);
    for (const [table, count] of Object.entries(before).filter(([, count]) => count > 0)) console.log(`${table}: ${count}`);
  } finally {
    connection.release();
    await db.pool.end();
  }
}

run().catch(error => { console.error(error); process.exit(1); });
