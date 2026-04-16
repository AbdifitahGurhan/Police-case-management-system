// database/seed.js - Seeds the database with sample data for testing
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Roles already inserted via schema INSERT statements
    // Insert Stations
    await db.query(`
      INSERT IGNORE INTO stations (name, code, region, district, address, phone, email) VALUES
      ('Mogadishu Central Police Station', 'MPS-001', 'Banadir', 'Hodan', 'Hodan District, Mogadishu', '+252-1-234567', 'central@police.so'),
      ('Hargeisa Main Police Station', 'HPS-001', 'Woqooyi Galbeed', 'Hargeisa', 'Main Road, Hargeisa', '+252-2-345678', 'hargeisa@police.so'),
      ('Bosaso Police Station', 'BPS-001', 'Bari', 'Bosaso', 'Port Road, Bosaso', '+252-3-456789', 'bosaso@police.so')
    `);

    // Hash passwords
    const adminHash = await bcrypt.hash('Admin@123', 12);
    const officerHash = await bcrypt.hash('Officer@123', 12);
    const cidHash = await bcrypt.hash('Cid@123', 12);
    const prosecutorHash = await bcrypt.hash('Prose@123', 12);

    // Insert sample users
    await db.query(`
      INSERT IGNORE INTO users (role_id, station_id, badge_number, full_name, email, phone, password_hash, rank) VALUES
      (1, 1, 'ADM-001', 'System Administrator', 'admin@police.so', '+252-61-1000001', ?, 'Admin'),
      (2, 1, 'OFC-001', 'Ahmed Hassan Omar', 'officer@police.so', '+252-61-2000001', ?, 'Sergeant'),
      (3, 1, 'CID-001', 'Fatima Abdi Said', 'cid@police.so', '+252-61-3000001', ?, 'Inspector'),
      (4, 1, 'PRS-001', 'Mohamed Salad Ali', 'prosecutor@police.so', '+252-61-4000001', ?, 'Senior Prosecutor')
    `, [adminHash, officerHash, cidHash, prosecutorHash]);

    // Insert sample complainant
    await db.query(`
      INSERT IGNORE INTO complainants (full_name, gender, age, phone, address) VALUES
      ('Halimo Yusuf Ibrahim', 'female', 35, '+252-61-5000001', 'Hodan District, Mogadishu'),
      ('Ali Warsame Farah', 'male', 42, '+252-61-5000002', 'Wadajir District, Mogadishu')
    `);

    // Generate OB numbers and insert sample cases
    await db.query(`
      INSERT IGNORE INTO cases (ob_number, title, description, incident_date, incident_location, case_type, status, priority, station_id, officer_id, complainant_id) VALUES
      ('OB-2024-00001', 'Armed Robbery at Bakaro Market', 'Complainant reports armed robbery. Three suspects with firearms robbed the market stall.', '2024-01-15', 'Bakaro Market, Hodan District', 'Robbery', 'open', 'high', 1, 2, 1),
      ('OB-2024-00002', 'Assault and Battery', 'Victim was assaulted outside a cafe. Requires medical attention.', '2024-01-20', 'Wadajir District', 'Assault', 'under_investigation', 'medium', 1, 2, 2),
      ('OB-2024-00003', 'Vehicle Theft', 'White Toyota Land Cruiser stolen from compound.', '2024-01-25', 'KM4 Area, Mogadishu', 'Theft', 'referred_cid', 'medium', 1, 2, 1)
    `);

    // Insert suspect
    await db.query(`
      INSERT IGNORE INTO suspects (full_name, alias, gender, age, description) VALUES
      ('Unknown Suspect 1', 'Snake', 'male', 30, 'Tall, medium build, scar on left cheek'),
      ('Unknown Suspect 2', null, 'male', 25, 'Short, wearing blue shirt at time of incident')
    `);

    // Link suspect to case 1
    await db.query(`
      INSERT IGNORE INTO case_suspects (case_id, suspect_id, role_in_case, added_by) VALUES
      (1, 1, 'Primary suspect', 2),
      (1, 2, 'Accomplice', 2)
    `);

    // Insert victim
    await db.query(`
      INSERT IGNORE INTO victims (full_name, gender, age, phone, injury_description) VALUES
      ('Ahmed Market Owner', 'male', 45, '+252-61-6000001', 'Minor bruises on hands from robbery')
    `);

    await db.query(`
      INSERT IGNORE INTO case_victims (case_id, victim_id, added_by) VALUES (1, 1, 2)`);

    // Insert sample referral
    await db.query(`
      INSERT IGNORE INTO referrals (case_id, referred_by, referred_to_role, reason, status) VALUES
      (3, 2, 'cid', 'Case requires specialized investigation. Vehicle tracking needed.', 'pending')
    `);

    // Insert sample audit log
    await db.query(`
      INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, new_data) VALUES
      (2, 'officer@police.so', 'CREATE_CASE', 'cases', 1, '{"ob_number":"OB-2024-00001","title":"Armed Robbery at Bakaro Market"}'),
      (2, 'officer@police.so', 'CREATE_CASE', 'cases', 2, '{"ob_number":"OB-2024-00002","title":"Assault and Battery"}')
    `);

    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('📋 Sample login credentials:');
    console.log('  Admin:      admin@police.so      / Admin@123');
    console.log('  Officer:    officer@police.so     / Officer@123');
    console.log('  CID:        cid@police.so         / Cid@123');
    console.log('  Prosecutor: prosecutor@police.so  / Prose@123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seed();
