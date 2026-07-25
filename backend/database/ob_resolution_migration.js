'use strict';
require('dotenv').config();
const db = require('../src/config/database');
async function add(name, definition) { const [rows]=await db.query('SHOW COLUMNS FROM ob_entries LIKE ?',[name]); if(!rows.length) await db.query(`ALTER TABLE ob_entries ADD COLUMN \`${name}\` ${definition}`); }
async function run(){
  await add('resolution_method',"ENUM('agreement','warning','mediation','withdrawn','false_report','other') NULL AFTER status");
  await add('resolution_notes','TEXT NULL AFTER resolution_method'); await add('resolution_parties','TEXT NULL AFTER resolution_notes');
  await add('resolved_by','VARCHAR(100) NULL AFTER resolution_parties'); await add('resolved_at','DATETIME NULL AFTER resolved_by');
  await add('reopen_reason','TEXT NULL AFTER resolved_at'); await add('reopened_by','VARCHAR(100) NULL AFTER reopen_reason'); await add('reopened_at','DATETIME NULL AFTER reopened_by');
  const [cols]=await db.query("SHOW COLUMNS FROM ob_attachments LIKE 'attachment_type'"); if(!cols.length) await db.query("ALTER TABLE ob_attachments ADD COLUMN attachment_type ENUM('evidence','resolution') DEFAULT 'evidence' AFTER ob_entry_id");
  console.log('OB resolution migration completed.'); await db.pool.end();
}
run().catch(async e=>{console.error(e.message);await db.pool.end();process.exit(1)});
