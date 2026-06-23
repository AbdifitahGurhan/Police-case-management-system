// database/seed.js - Seeds the current 5-tier Police CMS schema with sample data
'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../src/config/database');
const { ensureCourtCaseForPoliceCase } = require('../src/services/courtService');

async function columnExists(table, column) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows[0].count > 0;
}

async function addColumnIfMissing(table, column, definition) {
  if (!(await columnExists(table, column))) {
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Added compatibility column ${table}.${column}`);
  }
}

async function ensureCompatibilityColumns() {
  await addColumnIfMissing('users', 'profile_image', 'VARCHAR(500) NULL AFTER full_name');
  await addColumnIfMissing('users', 'phone', 'VARCHAR(30) NULL AFTER full_name');
  await addColumnIfMissing('users', 'rank', 'VARCHAR(100) NULL AFTER phone');
  await addColumnIfMissing('users', 'user_type', "ENUM('COMMANDER','OB_STAFF','STAFF') DEFAULT 'STAFF' AFTER rank");
  await addColumnIfMissing('users', 'assigned_level', "ENUM('ADMINISTRATION','STATE','REGION','DISTRICT_POLICE_STATION') DEFAULT NULL AFTER user_type");
  await addColumnIfMissing('users', 'state_administration_id', 'INT NULL AFTER assigned_level');
  await addColumnIfMissing('users', 'region_id', 'INT NULL AFTER state_administration_id');
  await addColumnIfMissing('users', 'district_id', 'INT NULL AFTER region_id');
  await addColumnIfMissing('users', 'is_commander', 'TINYINT(1) DEFAULT 0 AFTER district_id');
  await addColumnIfMissing('users', 'status', "ENUM('ACTIVE','INACTIVE','SUSPENDED') DEFAULT 'ACTIVE' AFTER is_commander");
  await addColumnIfMissing('users', 'created_by', 'VARCHAR(100) NULL AFTER last_login');
  await addColumnIfMissing('cases', 'case_number', 'VARCHAR(50) NULL UNIQUE FIRST');
  await addColumnIfMissing('cases', 'ob_entry_id', 'INT NULL AFTER ob_number');
  await addColumnIfMissing('cases', 'original_ob_staff_id', 'INT NULL AFTER ob_entry_id');
  await addColumnIfMissing('cases', 'original_ob_staff_name', 'VARCHAR(150) NULL AFTER original_ob_staff_id');
  await addColumnIfMissing('cases', 'incident_type', 'VARCHAR(100) NULL AFTER original_ob_staff_name');
  await addColumnIfMissing('cases', 'complainant_name', 'VARCHAR(150) NULL AFTER incident_type');
  await addColumnIfMissing('cases', 'complainant_phone', 'VARCHAR(30) NULL AFTER complainant_name');
  await addColumnIfMissing('cases', 'victim_name', 'VARCHAR(150) NULL AFTER complainant_phone');
  await addColumnIfMissing('cases', 'title', 'VARCHAR(255) NULL AFTER case_title');
  await addColumnIfMissing('cases', 'case_type', 'VARCHAR(100) NULL AFTER incident_location');
  await addColumnIfMissing('audit_logs', 'old_data', 'JSON NULL AFTER details');
  await addColumnIfMissing('audit_logs', 'new_data', 'JSON NULL AFTER old_data');
  await addColumnIfMissing('blockchain_records', 'hash_sha256', 'VARCHAR(64) NULL AFTER sha256_hash');
  await addColumnIfMissing('blockchain_records', 'data_snapshot', 'JSON NULL AFTER hash_sha256');
  await addColumnIfMissing('criminals', 'photo_url', 'VARCHAR(500) NULL AFTER description');
  await addColumnIfMissing('criminals', 'offender_photo', 'VARCHAR(500) NULL AFTER photo_url');
  await addColumnIfMissing('criminals', 'face_capture_image', 'VARCHAR(500) NULL AFTER offender_photo');
  await addColumnIfMissing('criminals', 'face_capture_notes', 'TEXT NULL AFTER face_capture_image');
  await addColumnIfMissing('criminals', 'profile_notes', 'TEXT NULL AFTER face_capture_notes');
  await addColumnIfMissing('criminals', 'arrest_status', "ENUM('not_arrested','arrested','released','wanted') DEFAULT 'not_arrested' AFTER profile_notes");
  await addColumnIfMissing('criminals', 'mother_name', 'VARCHAR(150) NULL AFTER full_name');
  await addColumnIfMissing('criminals', 'date_of_birth', 'DATE NULL AFTER gender');
  await addColumnIfMissing('criminals', 'fingerprint_hash', 'VARCHAR(255) NULL AFTER photo_url');
  await addColumnIfMissing('criminals', 'biometric_notes', 'TEXT NULL AFTER fingerprint_hash');
  await addColumnIfMissing('arrests', 'police_station_id', 'INT NULL AFTER suspect_id');
  await addColumnIfMissing('case_criminals', 'linked_by_user_id', 'VARCHAR(100) NULL AFTER criminal_id');
  await addColumnIfMissing('case_criminals', 'linked_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER linked_by_user_id');
  await addColumnIfMissing('case_criminals', 'status', "ENUM('active','removed') DEFAULT 'active' AFTER linked_at");
  await addColumnIfMissing('arrests', 'court_decision', "ENUM('pending','convicted','acquitted','dismissed','adjourned') DEFAULT 'pending' AFTER charges");
  await addColumnIfMissing('arrests', 'court_decision_notes', 'TEXT NULL AFTER court_decision');
  await addColumnIfMissing('arrests', 'sentence_period_value', 'INT NULL AFTER court_decision_notes');
  await addColumnIfMissing('arrests', 'sentence_period_unit', "ENUM('days','months','years') NULL AFTER sentence_period_value");
  await addColumnIfMissing('arrests', 'sentence_start_date', 'DATE NULL AFTER sentence_period_unit');
  await addColumnIfMissing('arrests', 'expected_release_date', 'DATE NULL AFTER sentence_start_date');
  await addColumnIfMissing('arrests', 'actual_release_date', 'DATE NULL AFTER expected_release_date');
  await addColumnIfMissing('arrests', 'sentence_status', "ENUM('awaiting_trial','sentenced','serving','release_review','completed','released','wanted','escaped','acquitted','dismissed') DEFAULT 'awaiting_trial' AFTER actual_release_date");
  await addColumnIfMissing('arrests', 'final_status', 'VARCHAR(100) NULL AFTER sentence_status');
  await db.query(`
    ALTER TABLE release_approvals
    MODIFY status ENUM('pending','approved','pending_admin_review','admin_reviewed','prison_confirmed','court_approved','certificate_generated','released','rejected') DEFAULT 'pending_admin_review'
  `);
  await db.query("UPDATE release_approvals SET status = 'pending_admin_review' WHERE status = 'pending'");
  await db.query("UPDATE release_approvals SET status = 'court_approved' WHERE status = 'approved'");
  await addColumnIfMissing('release_approvals', 'admin_reviewed_by', 'VARCHAR(100) NULL AFTER status');
  await addColumnIfMissing('release_approvals', 'admin_reviewed_at', 'TIMESTAMP NULL AFTER admin_reviewed_by');
  await addColumnIfMissing('release_approvals', 'admin_review_notes', 'TEXT NULL AFTER admin_reviewed_at');
  await addColumnIfMissing('release_approvals', 'prison_confirmed_by', 'VARCHAR(100) NULL AFTER admin_review_notes');
  await addColumnIfMissing('release_approvals', 'prison_confirmed_at', 'TIMESTAMP NULL AFTER prison_confirmed_by');
  await addColumnIfMissing('release_approvals', 'prison_confirmation_notes', 'TEXT NULL AFTER prison_confirmed_at');
  await addColumnIfMissing('release_approvals', 'court_approved_by', 'VARCHAR(100) NULL AFTER prison_confirmation_notes');
  await addColumnIfMissing('release_approvals', 'court_approved_at', 'TIMESTAMP NULL AFTER court_approved_by');
  await addColumnIfMissing('release_approvals', 'court_approval_notes', 'TEXT NULL AFTER court_approved_at');
  await addColumnIfMissing('release_approvals', 'certificate_number', 'VARCHAR(80) NULL AFTER court_approval_notes');
  await addColumnIfMissing('release_approvals', 'certificate_issued_by', 'VARCHAR(100) NULL AFTER certificate_number');
  await addColumnIfMissing('release_approvals', 'certificate_issued_at', 'TIMESTAMP NULL AFTER certificate_issued_by');
  await addColumnIfMissing('release_approvals', 'certificate_notes', 'TEXT NULL AFTER certificate_issued_at');
  await db.query('ALTER TABLE cases MODIFY incident_date DATETIME NULL');
  await db.query("ALTER TABLE ob_entries MODIFY status ENUM('OB_REGISTERED','FORWARDED_FOR_REVIEW','CONVERTED_TO_CASE','CASE_OPENED','CLOSED') DEFAULT 'OB_REGISTERED'");

  await db.query(`
    CREATE TABLE IF NOT EXISTS ob_entries (
      id INT PRIMARY KEY AUTO_INCREMENT,
      ob_number VARCHAR(50) NOT NULL UNIQUE,
      incident_type VARCHAR(100) NOT NULL,
      incident_location VARCHAR(255) NOT NULL,
      description TEXT,
      reported_by VARCHAR(150) NOT NULL,
      reporter_phone VARCHAR(30),
      registered_by_user_id INT NOT NULL,
      registered_by_name VARCHAR(150) NOT NULL,
      registered_by_role VARCHAR(100) NOT NULL,
      registered_by_rank VARCHAR(100),
      state_administration_id INT,
      region_id INT,
      district_id INT,
      registration_date DATE NOT NULL,
      registration_time TIME NOT NULL,
      status ENUM('OB_REGISTERED','FORWARDED_FOR_REVIEW','CASE_OPENED','CLOSED') DEFAULT 'OB_REGISTERED',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_ob_registered_by (registered_by_user_id),
      INDEX idx_ob_location (state_administration_id, region_id, district_id)
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      user_id VARCHAR(100),
      username VARCHAR(150),
      success TINYINT(1) NOT NULL DEFAULT 0,
      failure_reason VARCHAR(255),
      ip_address VARCHAR(50),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const genderTables = ['police_officers', 'complainants', 'criminals', 'victims', 'witnesses'];
  for (const table of genderTables) {
    await db.query(`UPDATE ${table} SET gender = 'male' WHERE gender NOT IN ('male', 'female') OR gender IS NULL`);
    await db.query(`ALTER TABLE ${table} MODIFY gender ENUM('male','female') DEFAULT 'male'`);
  }
}

async function getId(sql, params) {
  const [rows] = await db.query(sql, params);
  return rows[0]?.id || null;
}

async function insertIfMissing(selectSql, selectParams, insertSql, insertParams) {
  const existingId = await getId(selectSql, selectParams);
  if (existingId) return existingId;
  const [result] = await db.query(insertSql, insertParams);
  return result.insertId;
}

function sha256(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function repairCaseSampleData() {
  await db.query(`
    UPDATE cases
    SET case_number = CONCAT('CASE-SAMPLE-', LPAD(id, 5, '0'))
    WHERE case_number IS NULL OR case_number = ''
  `);

  await db.query(`
    UPDATE cases
    SET case_title = CONCAT(
      COALESCE(NULLIF(incident_type, ''), NULLIF(case_type, ''), 'Police Case'),
      ' - ',
      ob_number
    )
    WHERE case_title IS NULL OR case_title = ''
  `);

  await db.query(`
    UPDATE cases
    SET title = case_title
    WHERE title IS NULL OR title = ''
  `);
}

async function seedCourtData() {
  console.log('Seeding court module sample data...');
  // 1. Get all cases that are court ready (or referred/approved for court)
  const [cases] = await db.query(`
    SELECT id, case_title, case_number, ob_number
    FROM cases
    WHERE status IN ('ready_for_court', 'forwarded_to_court', 'approved_for_court', 'referred_to_court')
  `);

  for (const c of cases) {
    // Sync into court_cases
    const result = await ensureCourtCaseForPoliceCase(c.id, 'system');
    if (!result) continue;
    const courtCaseId = result.id;

    // 2. Add sample hearings
    const [hearingResult] = await db.query(`
      INSERT INTO court_hearings (court_case_id, hearing_type, hearing_date, hearing_time, court_room, assigned_judge, status, created_by)
      VALUES (?, 'preliminary', DATE_ADD(CURDATE(), INTERVAL 2 DAY), '09:30:00', 'Room 3', 'Judge Ahmed', 'scheduled', 'system')
    `, [courtCaseId]);

    const [hearingCompletedResult] = await db.query(`
      INSERT INTO court_hearings (court_case_id, hearing_type, hearing_date, hearing_time, court_room, assigned_judge, status, created_by)
      VALUES (?, 'evidence', DATE_SUB(CURDATE(), INTERVAL 3 DAY), '10:00:00', 'Room 1', 'Judge Ahmed', 'completed', 'system')
    `, [courtCaseId]);

    // 3. Add sample proceeding for completed hearing
    await db.query(`
      INSERT INTO court_proceedings (court_case_id, hearing_id, proceeding_date, notes, judge_remarks, prosecutor_remarks, defense_remarks, created_by)
      VALUES (?, ?, DATE_SUB(CURDATE(), INTERVAL 3 DAY), ?, ?, ?, ?, ?)
    `, [
      courtCaseId,
      hearingCompletedResult.insertId,
      'Prosecution presented CCTV evidence and physical exhibits. Witnesses testified.',
      'Evidence is admitted. Hearing set for final judgment.',
      'Request conviction based on overwhelming evidence.',
      "Requested mercy due to client's cooperation.",
      'system'
    ]);

    // 4. Update status of the case to "in_trial" or "judgment_issued" if it has sentence/judgment in arrests table
    // Let's check if there's an arrest with a court conviction
    const [[arrest]] = await db.query(`
      SELECT * FROM arrests WHERE case_id = ? AND court_decision IN ('convicted', 'acquitted', 'dismissed')
    `, [c.id]);

    if (arrest) {
      // Add sample judgment matching the arrest decision
      const [judgmentResult] = await db.query(`
        INSERT INTO court_judgments (court_case_id, judge_name, decision_date, decision_type, judgment_summary, created_by)
        VALUES (?, 'Judge Ahmed', DATE_SUB(CURDATE(), INTERVAL 1 DAY), ?, ?, 'system')
      `, [courtCaseId, arrest.court_decision, arrest.court_decision_notes || 'judgment issued by regional court']);

      // Update court case status and outcome
      await db.query(`
        UPDATE court_cases
        SET status = ?, final_outcome = ?
        WHERE id = ?
      `, [arrest.court_decision === 'convicted' ? 'sentenced' : 'closed', arrest.court_decision, courtCaseId]);

      if (arrest.court_decision === 'convicted') {
        // Add sample sentence matching the arrest sentence details
        await db.query(`
          INSERT INTO court_sentences (court_case_id, defendant_name, sentence_type, duration, fine_amount, sentence_date, created_by)
          VALUES (?, (SELECT full_name FROM criminals WHERE id = ?), 'imprisonment', ?, 500.00, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'system')
        `, [
          courtCaseId,
          arrest.suspect_id,
          arrest.sentence_period_value ? `${arrest.sentence_period_value} ${arrest.sentence_period_unit}` : '2 years'
        ]);
      }
    }
  }
}

async function seed() {
  try {
    console.log('Starting current-schema seed...');
    await ensureCompatibilityColumns();

    const adminHash = await bcrypt.hash('Admin@123', 12);
    const officerHash = await bcrypt.hash('Officer@123', 12);
    const cidHash = await bcrypt.hash('Cid@123', 12);
    const unitHash = await bcrypt.hash('Unit@123', 12);
    const specialHash = await bcrypt.hash('Special@123', 12);

    await db.query(`
      INSERT INTO roles (name, description) VALUES
      ('admin', 'System administrator with full access'),
      ('officer', 'Police officer who registers and manages cases'),
      ('cid', 'CID investigator who handles referred investigations'),
      ('ward_commander', 'Commander who reviews and confirms cases'),
      ('STATE_COMMANDER', 'Commander responsible for one state'),
      ('REGION_COMMANDER', 'Commander responsible for one region'),
      ('DISTRICT_COMMANDER', 'Commander responsible for one district / police station'),
      ('POLICE_STATION_COMMANDER', 'Commander responsible for one district / police station'),
      ('WAAX_COMMANDER', 'Commander responsible for one waax'),
      ('OB_STAFF', 'Occurrence Book staff member'),
      ('STAFF', 'Operational staff member'),
      ('court', 'Court system role'),
      ('judge', 'Court judge role'),
      ('prosecutor', 'Court prosecutor role'),
      ('jail', 'Jail system role')
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `);

    const adminRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['admin']);
    const officerRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['officer']);
    const cidRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['cid']);
    const obStaffRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['OB_STAFF']);
    const staffRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['STAFF']);
    const stationCommanderRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['POLICE_STATION_COMMANDER']);
    const courtRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['court']);
    const judgeRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['judge']);
    const prosecutorRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['prosecutor']);
    const jailRoleId = await getId('SELECT id FROM roles WHERE name = ?', ['jail']);

    await db.query(`
      INSERT INTO users (role_id, username, email, full_name, password_hash, is_active, user_type) VALUES
      (?, 'admin', 'admin@police.so', 'System Administrator', ?, 1, 'STAFF'),
      (?, 'officer', 'officer@police.so', 'Ahmed Hassan Omar', ?, 1, 'STAFF'),
      (?, 'cid', 'cid@police.so', 'Fatima Abdi Said', ?, 1, 'STAFF'),
      (?, 'court_user', 'court@court.gov.so', 'Mogadishu Regional Court', ?, 1, 'STAFF'),
      (?, 'judge_user', 'judge@court.gov.so', 'Judge Hassan Ali', ?, 1, 'STAFF'),
      (?, 'prosecutor_user', 'prosecutor@court.gov.so', 'Prosecutor Amina Yusuf', ?, 1, 'STAFF'),
      (?, 'jail_user', 'jail@prisons.gov.so', 'Mogadishu Central Jail', ?, 1, 'STAFF')
      ON DUPLICATE KEY UPDATE
        role_id = VALUES(role_id),
        email = VALUES(email),
        full_name = VALUES(full_name),
        password_hash = VALUES(password_hash),
        is_active = 1
    `, [
      adminRoleId, adminHash, 
      officerRoleId, officerHash, 
      cidRoleId, cidHash, 
      courtRoleId, specialHash, 
      judgeRoleId, specialHash,
      prosecutorRoleId, specialHash,
      jailRoleId, specialHash
    ]);

    await db.query(`
      INSERT INTO ranks (rank_name, rank_code, description) VALUES
      ('Commissioner', 'COMM', 'Senior command rank'),
      ('Inspector', 'INSP', 'Investigation and supervision rank'),
      ('Sergeant', 'SGT', 'Field supervision rank'),
      ('Constable', 'CST', 'Operational police officer rank')
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `);

    const commissionerId = await getId('SELECT id FROM ranks WHERE rank_code = ?', ['COMM']);
    const inspectorId = await getId('SELECT id FROM ranks WHERE rank_code = ?', ['INSP']);
    const sergeantId = await getId('SELECT id FROM ranks WHERE rank_code = ?', ['SGT']);
    const constableId = await getId('SELECT id FROM ranks WHERE rank_code = ?', ['CST']);

    await db.query(`
      INSERT INTO police_officers
        (full_name, force_number, rank_id, phone, email, gender, date_of_birth, address, employment_status, created_by)
      VALUES
        ('Gen. Abdullahi Warsame', 'SPF-0001', ?, '+252-61-1000001', 'commander@police.so', 'male', '1976-04-12', 'Mogadishu', 'active', 'admin'),
        ('Insp. Sahra Mohamed', 'SPF-0101', ?, '+252-61-1000101', 'sahra@police.so', 'female', '1985-08-20', 'Hodan, Mogadishu', 'active', 'admin'),
        ('Sgt. Ahmed Hassan Omar', 'SPF-0201', ?, '+252-61-2000001', 'ahmed.hassan@police.so', 'male', '1990-02-05', 'Wadajir, Mogadishu', 'active', 'admin'),
        ('Const. Amina Yusuf', 'SPF-0301', ?, '+252-61-3000001', 'amina.yusuf@police.so', 'female', '1994-11-16', 'Hamar Weyne, Mogadishu', 'active', 'admin')
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        rank_id = VALUES(rank_id),
        phone = VALUES(phone),
        email = VALUES(email),
        employment_status = VALUES(employment_status)
    `, [commissionerId, inspectorId, sergeantId, constableId]);

    const commanderId = await getId('SELECT id FROM police_officers WHERE force_number = ?', ['SPF-0001']);
    const inspectorOfficerId = await getId('SELECT id FROM police_officers WHERE force_number = ?', ['SPF-0101']);
    const sergeantOfficerId = await getId('SELECT id FROM police_officers WHERE force_number = ?', ['SPF-0201']);
    const constableOfficerId = await getId('SELECT id FROM police_officers WHERE force_number = ?', ['SPF-0301']);

    const stateAdministrations = [
      ['Puntland', 'PNT', 'puntland_admin'],
      ['Jubaland', 'JBL', 'jubaland_admin'],
      ['Hirshabelle', 'HSH', 'hirshabelle_admin'],
      ['Galmudug', 'GLM', 'galmudug_admin'],
      ['South West State', 'SWS', 'south_west_admin'],
      ['SSC-Khaatumo', 'SSC', 'ssc_khaatumo_admin'],
      ['Banaadir', 'BNDR', 'banadir_admin'],
    ];

    await db.query(`
      INSERT INTO state_administrations
        (state_name, state_code, username, password_hash, commander_officer_id, created_by)
      VALUES ${stateAdministrations.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}
      ON DUPLICATE KEY UPDATE
        state_name = VALUES(state_name),
        username = VALUES(username),
        password_hash = VALUES(password_hash),
        commander_officer_id = VALUES(commander_officer_id)
    `, stateAdministrations.flatMap(([stateName, stateCode, username]) => [
      stateName,
      stateCode,
      username,
      unitHash,
      commanderId,
      'admin',
    ]));
    const stateId = await getId('SELECT id FROM state_administrations WHERE state_code = ?', ['BNDR']);

    await db.query(`
      INSERT INTO regions
        (state_administration_id, region_name, region_code, username, password_hash, commander_officer_id, created_by)
      VALUES
        (?, 'Mogadishu Region', 'MGD', 'mogadishu_region', ?, ?, 'admin')
      ON DUPLICATE KEY UPDATE
        state_administration_id = VALUES(state_administration_id),
        region_name = VALUES(region_name),
        username = VALUES(username),
        password_hash = VALUES(password_hash),
        commander_officer_id = VALUES(commander_officer_id)
    `, [stateId, unitHash, inspectorOfficerId]);
    const regionId = await getId('SELECT id FROM regions WHERE region_code = ?', ['MGD']);

    await db.query(`
      INSERT INTO cities
        (region_id, city_name, city_code, username, password_hash, commander_officer_id, created_by)
      VALUES
        (?, 'Mogadishu City', 'MOG', 'mogadishu_city', ?, ?, 'admin')
      ON DUPLICATE KEY UPDATE
        region_id = VALUES(region_id),
        city_name = VALUES(city_name),
        username = VALUES(username),
        password_hash = VALUES(password_hash),
        commander_officer_id = VALUES(commander_officer_id)
    `, [regionId, unitHash, inspectorOfficerId]);
    const cityId = await getId('SELECT id FROM cities WHERE city_code = ?', ['MOG']);

    await db.query(`
      INSERT INTO districts
        (city_id, district_name, district_code, username, password_hash, commander_officer_id, created_by)
      VALUES
        (?, 'Hodan District', 'HDN', 'hodan_district', ?, ?, 'admin'),
        (?, 'Wadajir District', 'WDJ', 'wadajir_district', ?, ?, 'admin')
      ON DUPLICATE KEY UPDATE
        city_id = VALUES(city_id),
        district_name = VALUES(district_name),
        username = VALUES(username),
        password_hash = VALUES(password_hash),
        commander_officer_id = VALUES(commander_officer_id)
    `, [cityId, unitHash, sergeantOfficerId, cityId, unitHash, constableOfficerId]);
    const hodanDistrictId = await getId('SELECT id FROM districts WHERE district_code = ?', ['HDN']);
    const wadajirDistrictId = await getId('SELECT id FROM districts WHERE district_code = ?', ['WDJ']);

    await db.query(`
      INSERT INTO users
        (role_id, username, email, full_name, phone, \`rank\`, user_type, assigned_level,
         state_administration_id, region_id, district_id,
         is_commander, password_hash, is_active, status, created_by)
      VALUES
        (?, 'ahmed.ob', 'ahmed.ob@police.so', 'Ahmed Ali', '+252-61-4000001', 'Sergeant', 'OB_STAFF', 'DISTRICT_POLICE_STATION',
         ?, ?, ?, 0, ?, 1, 'ACTIVE', 'admin'),
        (?, 'hodan.staff', 'hodan.staff@police.so', 'Amina Yusuf', '+252-61-4000002', 'Constable', 'STAFF', 'DISTRICT_POLICE_STATION',
         ?, ?, ?, 0, ?, 1, 'ACTIVE', 'admin'),
        (?, 'hodan.commander', 'hodan.commander@police.so', 'Hodan Police Station Commander', '+252-61-4000003', 'Inspector', 'COMMANDER', 'DISTRICT_POLICE_STATION',
         ?, ?, ?, 1, ?, 1, 'ACTIVE', 'admin')
      ON DUPLICATE KEY UPDATE
        full_name = VALUES(full_name),
        phone = VALUES(phone),
        \`rank\` = VALUES(\`rank\`),
        user_type = VALUES(user_type),
        assigned_level = VALUES(assigned_level),
        state_administration_id = VALUES(state_administration_id),
        region_id = VALUES(region_id),
        district_id = VALUES(district_id),
        is_commander = VALUES(is_commander),
        password_hash = VALUES(password_hash),
        is_active = 1,
        status = 'ACTIVE'
    `, [
      obStaffRoleId, stateId, regionId, hodanDistrictId, officerHash,
      staffRoleId, stateId, regionId, hodanDistrictId, officerHash,
      stationCommanderRoleId, stateId, regionId, hodanDistrictId, officerHash,
    ]);

    await db.query(`
      INSERT INTO officer_assignments (officer_id, assignment_type, assignment_id, is_current, assigned_by, remarks)
      SELECT ?, 'State administration', ?, 1, 'admin', 'Seed assignment'
      WHERE NOT EXISTS (SELECT 1 FROM officer_assignments WHERE officer_id = ? AND assignment_type = 'State administration' AND assignment_id = ? AND is_current = 1)
    `, [commanderId, stateId, commanderId, stateId]);
    await db.query(`
      INSERT INTO officer_assignments (officer_id, assignment_type, assignment_id, is_current, assigned_by, remarks)
      SELECT ?, 'District', ?, 1, 'admin', 'Seed assignment'
      WHERE NOT EXISTS (SELECT 1 FROM officer_assignments WHERE officer_id = ? AND assignment_type = 'District' AND assignment_id = ? AND is_current = 1)
    `, [sergeantOfficerId, hodanDistrictId, sergeantOfficerId, hodanDistrictId]);
    await db.query(`
      INSERT INTO officer_transfers
        (officer_id, from_assignment_type, from_assignment_id, to_assignment_type, to_assignment_id, transfer_reason, transferred_by, remarks)
      SELECT ?, 'District', ?, 'District', ?, 'Operational coverage for sample data', 'admin', 'Seed transfer'
      WHERE NOT EXISTS (SELECT 1 FROM officer_transfers WHERE officer_id = ? AND to_assignment_type = 'District' AND to_assignment_id = ?)
    `, [sergeantOfficerId, hodanDistrictId, hodanDistrictId, sergeantOfficerId, hodanDistrictId]);

    await db.query(`
      INSERT INTO complainants (full_name, gender, age, nationality, id_type, id_number, phone, address, email)
      SELECT 'Halimo Yusuf Ibrahim', 'female', 35, 'Somali', 'National ID', 'NID-SAMPLE-001', '+252-61-5000001', 'Hodan District, Mogadishu', 'halimo@example.so'
      WHERE NOT EXISTS (SELECT 1 FROM complainants WHERE id_number = 'NID-SAMPLE-001')
    `);
    await db.query(`
      INSERT INTO complainants (full_name, gender, age, nationality, id_type, id_number, phone, address, email)
      SELECT 'Ali Warsame Farah', 'male', 42, 'Somali', 'Passport', 'PASS-SAMPLE-002', '+252-61-5000002', 'Wadajir District, Mogadishu', 'ali@example.so'
      WHERE NOT EXISTS (SELECT 1 FROM complainants WHERE id_number = 'PASS-SAMPLE-002')
    `);

    await db.query(`
      INSERT INTO cases
        (case_title, title, ob_number, description, incident_date, incident_location, case_type, status, priority,
         state_administration_id, region_id, city_id, district_id, assigned_officer_id, created_by)
      VALUES
        ('Armed Robbery at Bakaro Market', 'Armed Robbery at Bakaro Market', 'OB-2026-00001',
         'Complainant reports an armed robbery involving two criminals at a market stall.', '2026-05-01',
         'Bakaro Market, Hodan District', 'Robbery', 'DRAFT', 'high', ?, ?, ?, ?, ?, 'officer'),
        ('Vehicle Theft near Airport Road', 'Vehicle Theft near Airport Road', 'OB-2026-00002',
         'White Toyota Land Cruiser reported stolen from a residential compound.', '2026-05-03',
         'Airport Road, Wadajir District', 'Theft', 'PENDING_COMMANDER_REVIEW', 'medium', ?, ?, ?, ?, ?, 'officer'),
        ('Assault Outside Cafe', 'Assault Outside Cafe', 'OB-2026-00003',
         'Victim reports assault outside a cafe; medical report pending.', '2026-05-05',
         'Hodan District, Mogadishu', 'Assault', 'CONFIRMED_BY_COMMANDER', 'critical', ?, ?, ?, ?, ?, 'cid')
      ON DUPLICATE KEY UPDATE
        case_title = VALUES(case_title),
        title = VALUES(title),
        description = VALUES(description),
        incident_date = VALUES(incident_date),
        incident_location = VALUES(incident_location),
        case_type = VALUES(case_type),
        status = VALUES(status),
        priority = VALUES(priority),
        assigned_officer_id = VALUES(assigned_officer_id)
    `, [
      stateId, regionId, cityId, hodanDistrictId, sergeantOfficerId,
      stateId, regionId, cityId, wadajirDistrictId, constableOfficerId,
      stateId, regionId, cityId, hodanDistrictId, inspectorOfficerId,
    ]);

    const robberyCaseId = await getId('SELECT id FROM cases WHERE ob_number = ?', ['OB-2026-00001']);
    const theftCaseId = await getId('SELECT id FROM cases WHERE ob_number = ?', ['OB-2026-00002']);
    const assaultCaseId = await getId('SELECT id FROM cases WHERE ob_number = ?', ['OB-2026-00003']);

    const suspectOneId = await insertIfMissing(
      'SELECT id FROM criminals WHERE id_number = ?',
      ['SUS-SAMPLE-001'],
      `INSERT INTO criminals (full_name, alias, gender, age, nationality, id_type, id_number, phone, address, description, is_arrested)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Abdi Unknown', 'Dheere', 'male', 30, 'Somali', 'Police File', 'SUS-SAMPLE-001', '+252-61-7000001', 'Unknown address', 'Tall suspect seen on CCTV near Bakaro Market.', 1]
    );
    const suspectTwoId = await insertIfMissing(
      'SELECT id FROM criminals WHERE id_number = ?',
      ['SUS-SAMPLE-002'],
      `INSERT INTO criminals (full_name, alias, gender, age, nationality, id_type, id_number, phone, address, description, is_arrested)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Unknown Vehicle Driver', 'Driver', 'male', 28, 'Somali', 'Police File', 'SUS-SAMPLE-002', null, 'Wadajir area', 'Suspected driver involved in vehicle theft.', 0]
    );

    await db.query(`
      INSERT IGNORE INTO case_criminals (case_id, criminal_id, role_in_case, notes, added_by) VALUES
      (?, ?, 'Primary suspect', 'Linked to robbery sample case.', 'officer'),
      (?, ?, 'Person of interest', 'Linked to vehicle theft sample case.', 'officer')
    `, [robberyCaseId, suspectOneId, theftCaseId, suspectTwoId]);

    const victimOneId = await insertIfMissing(
      'SELECT id FROM victims WHERE id_number = ?',
      ['VIC-SAMPLE-001'],
      `INSERT INTO victims (full_name, gender, age, nationality, id_type, id_number, phone, address, injury_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Ahmed Market Owner', 'male', 45, 'Somali', 'National ID', 'VIC-SAMPLE-001', '+252-61-6000001', 'Bakaro Market', 'Minor bruises on hands.']
    );
    const victimTwoId = await insertIfMissing(
      'SELECT id FROM victims WHERE id_number = ?',
      ['VIC-SAMPLE-002'],
      `INSERT INTO victims (full_name, gender, age, nationality, id_type, id_number, phone, address, injury_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Layla Abdi Nur', 'female', 29, 'Somali', 'National ID', 'VIC-SAMPLE-002', '+252-61-6000002', 'Hodan District', 'Facial bruising reported.']
    );

    await db.query(`
      INSERT IGNORE INTO case_victims (case_id, victim_id, notes, added_by) VALUES
      (?, ?, 'Shop owner affected by robbery.', 'officer'),
      (?, ?, 'Assault victim statement pending.', 'cid')
    `, [robberyCaseId, victimOneId, assaultCaseId, victimTwoId]);

    const witnessId = await insertIfMissing(
      'SELECT id FROM witnesses WHERE phone = ?',
      ['+252-61-8000001'],
      `INSERT INTO witnesses (full_name, gender, age, phone, address, relationship_to_case)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Maryan Said Osman', 'female', 33, '+252-61-8000001', 'Bakaro Market', 'Eyewitness']
    );
    await db.query(`
      INSERT INTO witness_statements (case_id, witness_id, statement, statement_date, taken_by)
      SELECT ?, ?, 'Witness saw two men leaving the market area immediately after the incident.', '2026-05-02', 'officer'
      WHERE NOT EXISTS (SELECT 1 FROM witness_statements WHERE case_id = ? AND witness_id = ?)
    `, [robberyCaseId, witnessId, robberyCaseId, witnessId]);

    const evidenceHash = sha256({ case_id: robberyCaseId, title: 'CCTV Screenshot', evidence_number: 'EV-2026-0001-001' });
    await db.query(`
      INSERT INTO evidence
        (case_id, evidence_number, type, title, description, file_url, file_size, mime_type, collected_by, collection_date, location_found, status, hash_sha256)
      VALUES
        (?, 'EV-2026-0001-001', 'photo', 'CCTV Screenshot', 'Still image from market CCTV camera.', '/uploads/sample-cctv.jpg', 245760, 'image/jpeg', 'officer', '2026-05-02', 'Bakaro Market security office', 'collected', ?),
        (?, 'EV-2026-0002-001', 'document', 'Vehicle Ownership Form', 'Ownership document supplied by complainant.', '/uploads/sample-vehicle-form.pdf', 102400, 'application/pdf', 'officer', '2026-05-04', 'Airport Road Station', 'submitted', ?)
      ON DUPLICATE KEY UPDATE
        case_id = VALUES(case_id),
        title = VALUES(title),
        description = VALUES(description),
        status = VALUES(status),
        hash_sha256 = VALUES(hash_sha256)
    `, [robberyCaseId, evidenceHash, theftCaseId, sha256({ case_id: theftCaseId, title: 'Vehicle Ownership Form' })]);
    const evidenceId = await getId('SELECT id FROM evidence WHERE evidence_number = ?', ['EV-2026-0001-001']);

    await db.query(`
      INSERT INTO chain_of_custody (evidence_id, transferred_from, transferred_to, reason, location, notes)
      SELECT ?, NULL, 'officer', 'Initial collection', 'Bakaro Market security office', 'Collected during sample seed'
      WHERE NOT EXISTS (SELECT 1 FROM chain_of_custody WHERE evidence_id = ? AND reason = 'Initial collection')
    `, [evidenceId, evidenceId]);
    await db.query(`
      INSERT INTO arrests
        (case_id, suspect_id, police_station_id, arrested_by, arrest_location, charges, court_decision,
         sentence_period_value, sentence_period_unit, sentence_start_date, expected_release_date,
         sentence_status, bail_status, bail_amount, notes)
      SELECT ?, ?, ?, 'officer', 'Hodan District checkpoint', 'Armed robbery and possession of stolen property',
             'convicted', 18, 'months', '2026-05-06', '2027-11-06', 'serving', 'no_bail', NULL, 'Sample arrest record'
       WHERE NOT EXISTS (SELECT 1 FROM arrests WHERE case_id = ? AND suspect_id = ?)
    `, [robberyCaseId, suspectOneId, hodanDistrictId, robberyCaseId, suspectOneId]);

    await db.query(`
      INSERT INTO referrals (case_id, referred_by, referred_to_role, referred_to_user, reason, notes, status, response, responded_at)
      SELECT ?, 'officer', 'cid', 'cid', 'Special investigation required for organized robbery.', 'Seed referral for CID workflow.', 'accepted', 'CID accepted the case for investigation.', NOW()
      WHERE NOT EXISTS (SELECT 1 FROM referrals WHERE case_id = ? AND referred_to_role = 'cid')
    `, [robberyCaseId, robberyCaseId]);
    await db.query(`
      INSERT INTO case_confirmations (case_id, commander_user_id, confirmation_status, comments)
      SELECT ?, 'hodan.commander', 'approved', 'Case reviewed and approved for investigation.'
      WHERE NOT EXISTS (SELECT 1 FROM case_confirmations WHERE case_id = ? AND commander_user_id = 'hodan.commander')
    `, [robberyCaseId, robberyCaseId]);

    const chainHash = sha256({ entity_type: 'case', entity_id: robberyCaseId, ob_number: 'OB-2026-00001' });
    const blockchainId = await insertIfMissing(
      'SELECT id FROM blockchain_records WHERE entity_type = ? AND entity_id = ?',
      ['case', robberyCaseId],
      `INSERT INTO blockchain_records
         (entity_type, entity_id, proof_version, sha256_hash, hash_sha256, data_snapshot, created_by)
       VALUES (?, ?, 1, ?, ?, ?, ?)`,
      ['case', robberyCaseId, chainHash, chainHash, JSON.stringify({ ob_number: 'OB-2026-00001', title: 'Armed Robbery at Bakaro Market' }), 'officer']
    );
    await db.query(`
      INSERT INTO case_transfers
        (case_id, from_state_administration_id, from_region_id, from_city_id, from_district_id,
         to_state_administration_id, to_region_id, to_city_id, to_district_id,
         from_officer_id, to_officer_id, transferred_by, transfer_reason, transfer_type, blockchain_record_id)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'officer', 'Escalated to CID investigator for follow-up.', 'investigation', ?
      WHERE NOT EXISTS (SELECT 1 FROM case_transfers WHERE case_id = ? AND transfer_type = 'investigation')
    `, [
      robberyCaseId,
      stateId, regionId, cityId, hodanDistrictId,
      stateId, regionId, cityId, hodanDistrictId,
      sergeantOfficerId, inspectorOfficerId, blockchainId, robberyCaseId,
    ]);

    await db.query(`
      INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after)
      SELECT ?, 'officer', 'CASE_CREATED', 'Sample case registered.', NULL, 'DRAFT'
      WHERE NOT EXISTS (SELECT 1 FROM case_actions WHERE case_id = ? AND action_type = 'CASE_CREATED')
    `, [robberyCaseId, robberyCaseId]);
    await db.query(`
      INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, new_data, ip_address, user_agent)
      SELECT 'officer', 'officer@police.so', 'SEED_SAMPLE_DATA', 'cases', ?, ?, ?, '127.0.0.1', 'seed-script'
      WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'SEED_SAMPLE_DATA' AND entity_type = 'cases' AND entity_id = ?)
    `, [
      robberyCaseId,
      JSON.stringify({ message: 'Seeded sample case data' }),
      JSON.stringify({ ob_number: 'OB-2026-00001', title: 'Armed Robbery at Bakaro Market' }),
      robberyCaseId,
    ]);

    await db.query(`
      INSERT INTO complainants (full_name, gender, age, nationality, id_type, id_number, phone, address, email)
      SELECT 'Amina Mohamed Hassan', 'female', 31, 'Somali', 'National ID', 'HDN-COM-001', '+252-61-5100101', 'Taleex Road, Hodan District', 'amina.hassan@example.so'
      WHERE NOT EXISTS (SELECT 1 FROM complainants WHERE id_number = 'HDN-COM-001')
    `);
    await db.query(`
      INSERT INTO complainants (full_name, gender, age, nationality, id_type, id_number, phone, address, email)
      SELECT 'Yusuf Ahmed Barre', 'male', 39, 'Somali', 'National ID', 'HDN-COM-002', '+252-61-5100102', 'Bakaro Market, Hodan District', 'yusuf.barre@example.so'
      WHERE NOT EXISTS (SELECT 1 FROM complainants WHERE id_number = 'HDN-COM-002')
    `);

    await db.query(`
      INSERT INTO cases
        (case_title, title, ob_number, description, incident_date, incident_location, case_type, status, priority,
         state_administration_id, region_id, city_id, district_id, assigned_officer_id, created_by)
      VALUES
        ('Hodan Station Mobile Phone Robbery', 'Hodan Station Mobile Phone Robbery', 'OB-HDN-2026-001',
         'Complainant reported that two criminals robbed a mobile phone and cash near Taleex junction. Patrol recovered CCTV footage and identified one repeat offender.',
         '2026-05-10 20:15:00', 'Taleex Junction, Hodan District', 'Robbery', 'under_investigation', 'high',
         ?, ?, ?, ?, ?, 'hodan_district'),
        ('Hodan Station Narcotics Patrol Arrest', 'Hodan Station Narcotics Patrol Arrest', 'OB-HDN-2026-002',
         'Night patrol stopped a motorcycle near Bakaro entrance and recovered suspected narcotics prepared for street sale.',
         '2026-05-12 22:40:00', 'Bakaro South Gate, Hodan District', 'Narcotics', 'approved_for_court', 'critical',
         ?, ?, ?, ?, ?, 'hodan_district'),
        ('Hodan Station Shop Assault Complaint', 'Hodan Station Shop Assault Complaint', 'OB-HDN-2026-003',
         'Shop owner reported assault and property damage after a dispute. Parties were interviewed and the suspect was released after court dismissal.',
         '2026-05-14 16:20:00', 'Suuqa Bakaro, Hodan District', 'Assault', 'closed', 'medium',
         ?, ?, ?, ?, ?, 'hodan_district')
      ON DUPLICATE KEY UPDATE
        case_title = VALUES(case_title),
        title = VALUES(title),
        description = VALUES(description),
        incident_date = VALUES(incident_date),
        incident_location = VALUES(incident_location),
        case_type = VALUES(case_type),
        status = VALUES(status),
        priority = VALUES(priority),
        district_id = VALUES(district_id),
        assigned_officer_id = VALUES(assigned_officer_id),
        created_by = VALUES(created_by)
    `, [
      stateId, regionId, cityId, hodanDistrictId, sergeantOfficerId,
      stateId, regionId, cityId, hodanDistrictId, inspectorOfficerId,
      stateId, regionId, cityId, hodanDistrictId, sergeantOfficerId,
    ]);

    const hodanRobberyCaseId = await getId('SELECT id FROM cases WHERE ob_number = ?', ['OB-HDN-2026-001']);
    const hodanNarcoticsCaseId = await getId('SELECT id FROM cases WHERE ob_number = ?', ['OB-HDN-2026-002']);
    const hodanAssaultCaseId = await getId('SELECT id FROM cases WHERE ob_number = ?', ['OB-HDN-2026-003']);

    const hodanRobberySuspectId = await insertIfMissing(
      'SELECT id FROM criminals WHERE id_number = ?',
      ['HDN-SUS-001'],
      `INSERT INTO criminals (full_name, mother_name, alias, gender, date_of_birth, age, nationality, id_type, id_number, phone, address, description, fingerprint_hash, biometric_notes, is_arrested)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Mahad Ali Nur', 'Xaawo Said', 'Mahad Dheere', 'male', '1999-02-12', 27, 'Somali', 'Police File', 'HDN-SUS-001', '+252-61-7300101', 'Taleex area, Hodan', 'Repeat robbery suspect identified through face profile and witness statement.', sha256('HDN-SUS-001-face'), 'Sample face biometric hash recorded during Hodan station registration.', 1]
    );
    const hodanNarcoticsSuspectId = await insertIfMissing(
      'SELECT id FROM criminals WHERE id_number = ?',
      ['HDN-SUS-002'],
      `INSERT INTO criminals (full_name, mother_name, alias, gender, date_of_birth, age, nationality, id_type, id_number, phone, address, description, fingerprint_hash, biometric_notes, is_arrested)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Said Abukar Mohamud', 'Maryan Hassan', 'Saciid Moto', 'male', '1992-07-03', 34, 'Somali', 'Police File', 'HDN-SUS-002', '+252-61-7300102', 'Bakaro area, Hodan', 'Suspected narcotics distributor arrested during night patrol.', sha256('HDN-SUS-002-face'), 'Sample face biometric hash captured by Hodan station.', 1]
    );
    const hodanAssaultSuspectId = await insertIfMissing(
      'SELECT id FROM criminals WHERE id_number = ?',
      ['HDN-SUS-003'],
      `INSERT INTO criminals (full_name, mother_name, alias, gender, date_of_birth, age, nationality, id_type, id_number, phone, address, description, is_arrested)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Fadumo Omar Said', 'Asha Jama', 'Fadumo', 'female', '1996-11-22', 30, 'Somali', 'National ID', 'HDN-SUS-003', '+252-61-7300103', 'Bakaro Market, Hodan', 'Assault complaint suspect; released after case dismissal.', 0]
    );

    await db.query(`
      UPDATE criminals SET mother_name = ?, date_of_birth = ?
      WHERE id_number = ? AND (mother_name IS NULL OR date_of_birth IS NULL)
    `, ['Xaawo Said', '1999-02-12', 'HDN-SUS-001']);
    await db.query(`
      UPDATE criminals SET mother_name = ?, date_of_birth = ?
      WHERE id_number = ? AND (mother_name IS NULL OR date_of_birth IS NULL)
    `, ['Maryan Hassan', '1992-07-03', 'HDN-SUS-002']);
    await db.query(`
      UPDATE criminals SET mother_name = ?, date_of_birth = ?
      WHERE id_number = ? AND (mother_name IS NULL OR date_of_birth IS NULL)
    `, ['Asha Jama', '1996-11-22', 'HDN-SUS-003']);

    await db.query(`
      INSERT IGNORE INTO case_criminals (case_id, criminal_id, role_in_case, notes, added_by) VALUES
      (?, ?, 'Primary robbery suspect', 'Identified from CCTV and matched to prior Hodan robbery report.', 'hodan_district'),
      (?, ?, 'Primary narcotics suspect', 'Arrested with suspected narcotics evidence during night patrol.', 'hodan_district'),
      (?, ?, 'Assault suspect', 'Interviewed after shop dispute; court dismissed the complaint.', 'hodan_district')
    `, [
      hodanRobberyCaseId, hodanRobberySuspectId,
      hodanNarcoticsCaseId, hodanNarcoticsSuspectId,
      hodanAssaultCaseId, hodanAssaultSuspectId,
    ]);

    const hodanRobberyVictimId = await insertIfMissing(
      'SELECT id FROM victims WHERE id_number = ?',
      ['HDN-VIC-001'],
      `INSERT INTO victims (full_name, gender, age, nationality, id_type, id_number, phone, address, injury_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Amina Mohamed Hassan', 'female', 31, 'Somali', 'National ID', 'HDN-VIC-001', '+252-61-5100101', 'Taleex Road, Hodan District', 'No physical injury; phone and cash stolen.']
    );
    const hodanNarcoticsVictimId = await insertIfMissing(
      'SELECT id FROM victims WHERE id_number = ?',
      ['HDN-VIC-002'],
      `INSERT INTO victims (full_name, gender, age, nationality, id_type, id_number, phone, address, injury_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Community Public Safety', 'male', 1, 'Somali', 'Police File', 'HDN-VIC-002', null, 'Hodan District', 'Public safety harm recorded for narcotics patrol case.']
    );
    const hodanAssaultVictimId = await insertIfMissing(
      'SELECT id FROM victims WHERE id_number = ?',
      ['HDN-VIC-003'],
      `INSERT INTO victims (full_name, gender, age, nationality, id_type, id_number, phone, address, injury_description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Yusuf Ahmed Barre', 'male', 39, 'Somali', 'National ID', 'HDN-VIC-003', '+252-61-5100102', 'Bakaro Market, Hodan District', 'Minor arm bruising and damaged shop counter.']
    );

    await db.query(`
      INSERT IGNORE INTO case_victims (case_id, victim_id, notes, added_by) VALUES
      (?, ?, 'Complainant and robbery victim.', 'hodan_district'),
      (?, ?, 'Community safety victim entry for narcotics case.', 'hodan_district'),
      (?, ?, 'Shop owner and assault complainant.', 'hodan_district')
    `, [
      hodanRobberyCaseId, hodanRobberyVictimId,
      hodanNarcoticsCaseId, hodanNarcoticsVictimId,
      hodanAssaultCaseId, hodanAssaultVictimId,
    ]);

    const hodanWitnessOneId = await insertIfMissing(
      'SELECT id FROM witnesses WHERE phone = ?',
      ['+252-61-8100101'],
      `INSERT INTO witnesses (full_name, gender, age, phone, address, relationship_to_case)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Abdirahman Salad Muse', 'male', 41, '+252-61-8100101', 'Taleex Junction', 'Shop security guard']
    );
    const hodanWitnessTwoId = await insertIfMissing(
      'SELECT id FROM witnesses WHERE phone = ?',
      ['+252-61-8100102'],
      `INSERT INTO witnesses (full_name, gender, age, phone, address, relationship_to_case)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['Hodan Patrol Officer Witness', 'male', 36, '+252-61-8100102', 'Hodan Police Station', 'Arresting patrol witness']
    );

    await db.query(`
      INSERT INTO witness_statements (case_id, witness_id, statement, statement_date, taken_by)
      SELECT ?, ?, 'Witness confirmed the suspect followed the complainant from the shop exit before the robbery.', '2026-05-11', 'hodan_district'
      WHERE NOT EXISTS (SELECT 1 FROM witness_statements WHERE case_id = ? AND witness_id = ?)
    `, [hodanRobberyCaseId, hodanWitnessOneId, hodanRobberyCaseId, hodanWitnessOneId]);
    await db.query(`
      INSERT INTO witness_statements (case_id, witness_id, statement, statement_date, taken_by)
      SELECT ?, ?, 'Patrol witness recorded the stop, search, seizure, and arrest at Bakaro South Gate.', '2026-05-13', 'hodan_district'
      WHERE NOT EXISTS (SELECT 1 FROM witness_statements WHERE case_id = ? AND witness_id = ?)
    `, [hodanNarcoticsCaseId, hodanWitnessTwoId, hodanNarcoticsCaseId, hodanWitnessTwoId]);

    await db.query(`
      INSERT INTO evidence
        (case_id, evidence_number, type, title, description, file_url, file_size, mime_type, collected_by, collection_date, location_found, status, hash_sha256)
      VALUES
        (?, 'EV-HDN-2026-001-001', 'video', 'Taleex CCTV Clip', 'CCTV clip showing suspect movement before phone robbery.', '/uploads/hodan-taleex-cctv.mp4', 7340032, 'video/mp4', 'hodan_district', '2026-05-11', 'Taleex shop security office', 'analyzed', ?),
        (?, 'EV-HDN-2026-001-002', 'document', 'Victim Phone IMEI Report', 'IMEI and ownership statement for stolen phone.', '/uploads/hodan-phone-imei.pdf', 184320, 'application/pdf', 'hodan_district', '2026-05-11', 'Hodan station report desk', 'submitted', ?),
        (?, 'EV-HDN-2026-002-001', 'physical', 'Seized Narcotics Package', 'Sealed package tagged by Hodan night patrol.', '/uploads/hodan-seizure-photo.jpg', 512000, 'image/jpeg', 'hodan_district', '2026-05-13', 'Bakaro South Gate', 'submitted', ?)
      ON DUPLICATE KEY UPDATE
        case_id = VALUES(case_id),
        title = VALUES(title),
        description = VALUES(description),
        status = VALUES(status),
        hash_sha256 = VALUES(hash_sha256)
    `, [
      hodanRobberyCaseId, sha256({ case_id: hodanRobberyCaseId, title: 'Taleex CCTV Clip' }),
      hodanRobberyCaseId, sha256({ case_id: hodanRobberyCaseId, title: 'Victim Phone IMEI Report' }),
      hodanNarcoticsCaseId, sha256({ case_id: hodanNarcoticsCaseId, title: 'Seized Narcotics Package' }),
    ]);

    for (const evidenceNumber of ['EV-HDN-2026-001-001', 'EV-HDN-2026-001-002', 'EV-HDN-2026-002-001']) {
      const hodanEvidenceId = await getId('SELECT id FROM evidence WHERE evidence_number = ?', [evidenceNumber]);
      await db.query(`
        INSERT INTO chain_of_custody (evidence_id, transferred_from, transferred_to, reason, location, notes)
        SELECT ?, NULL, 'hodan_district', 'Initial collection by Hodan station', 'Hodan Police Station evidence room', 'Sample Hodan custody entry'
        WHERE NOT EXISTS (SELECT 1 FROM chain_of_custody WHERE evidence_id = ? AND reason = 'Initial collection by Hodan station')
      `, [hodanEvidenceId, hodanEvidenceId]);
      await db.query(`
        INSERT INTO chain_of_custody (evidence_id, transferred_from, transferred_to, reason, location, notes)
        SELECT ?, 'hodan_district', 'cid', 'Forwarded for technical review', 'CID evidence desk', 'Sample Hodan to CID transfer'
        WHERE NOT EXISTS (SELECT 1 FROM chain_of_custody WHERE evidence_id = ? AND reason = 'Forwarded for technical review')
      `, [hodanEvidenceId, hodanEvidenceId]);
    }

    await db.query(`
      INSERT INTO arrests
        (case_id, suspect_id, police_station_id, arrested_by, arrest_location, charges, court_decision,
         sentence_period_value, sentence_period_unit, sentence_start_date, expected_release_date,
         sentence_status, bail_status, bail_amount, notes)
      SELECT ?, ?, ?, 'hodan_district', 'Taleex Junction patrol point', 'Robbery, intimidation, and possession of stolen property',
             'pending', NULL, NULL, NULL, NULL, 'awaiting_trial', 'bail_pending', 300.00, 'Awaiting court hearing after Hodan investigation'
      WHERE NOT EXISTS (SELECT 1 FROM arrests WHERE case_id = ? AND suspect_id = ?)
    `, [hodanRobberyCaseId, hodanRobberySuspectId, hodanDistrictId, hodanRobberyCaseId, hodanRobberySuspectId]);
    await db.query(`
      INSERT INTO arrests
        (case_id, suspect_id, police_station_id, arrested_by, arrest_location, charges, court_decision,
         court_decision_notes, sentence_period_value, sentence_period_unit, sentence_start_date, expected_release_date,
         sentence_status, bail_status, bail_amount, notes)
      SELECT ?, ?, ?, 'hodan_district', 'Bakaro South Gate checkpoint', 'Possession and distribution of narcotics',
             'convicted', 'Court accepted patrol evidence and seizure report.', 2, 'years', '2026-05-16', '2028-05-16',
             'serving', 'no_bail', NULL, 'Convicted sample prisoner record from Hodan station'
      WHERE NOT EXISTS (SELECT 1 FROM arrests WHERE case_id = ? AND suspect_id = ?)
    `, [hodanNarcoticsCaseId, hodanNarcoticsSuspectId, hodanDistrictId, hodanNarcoticsCaseId, hodanNarcoticsSuspectId]);
    await db.query(`
      INSERT INTO arrests
        (case_id, suspect_id, police_station_id, arrested_by, arrest_location, charges, court_decision,
         court_decision_notes, sentence_status, bail_status, actual_release_date, final_status, notes)
      SELECT ?, ?, ?, 'hodan_district', 'Hodan Police Station report desk', 'Common assault and property damage',
             'dismissed', 'Complainant withdrew after mediation and court dismissed the file.', 'dismissed', 'bail_granted',
             '2026-05-17', 'released_after_dismissal', 'Closed sample case for Hodan station'
      WHERE NOT EXISTS (SELECT 1 FROM arrests WHERE case_id = ? AND suspect_id = ?)
    `, [hodanAssaultCaseId, hodanAssaultSuspectId, hodanDistrictId, hodanAssaultCaseId, hodanAssaultSuspectId]);

    await db.query(`
      INSERT INTO referrals (case_id, referred_by, referred_to_role, referred_to_user, reason, notes, status, response, responded_at)
      SELECT ?, 'hodan_district', 'cid', 'cid', 'Technical review requested for CCTV and repeat offender match.', 'Hodan station sample referral.', 'accepted', 'CID accepted technical support request.', NOW()
      WHERE NOT EXISTS (SELECT 1 FROM referrals WHERE case_id = ? AND referred_to_role = 'cid')
    `, [hodanRobberyCaseId, hodanRobberyCaseId]);
    await db.query(`
      INSERT INTO referrals (case_id, referred_by, referred_to_role, referred_to_user, reason, notes, status, response, responded_at)
      SELECT ?, 'hodan_district', 'court', 'court_user', 'Court file prepared after narcotics seizure and suspect interview.', 'Sample court referral.', 'accepted', 'Court hearing completed and sentence recorded.', NOW()
      WHERE NOT EXISTS (SELECT 1 FROM referrals WHERE case_id = ? AND referred_to_role = 'court')
    `, [hodanNarcoticsCaseId, hodanNarcoticsCaseId]);

    await db.query(`
      INSERT INTO case_confirmations (case_id, commander_user_id, confirmation_status, comments)
      SELECT ?, 'hodan_district', 'approved', 'District station commander approved investigation workflow.'
      WHERE NOT EXISTS (SELECT 1 FROM case_confirmations WHERE case_id = ? AND commander_user_id = 'hodan_district')
    `, [hodanRobberyCaseId, hodanRobberyCaseId]);
    await db.query(`
      INSERT INTO case_confirmations (case_id, commander_user_id, confirmation_status, comments)
      SELECT ?, 'hodan_district', 'approved', 'District station commander approved court submission.'
      WHERE NOT EXISTS (SELECT 1 FROM case_confirmations WHERE case_id = ? AND commander_user_id = 'hodan_district')
    `, [hodanNarcoticsCaseId, hodanNarcoticsCaseId]);

    const hodanBlockchainHash = sha256({ entity_type: 'case', station: 'hodan_district', ob_numbers: ['OB-HDN-2026-001', 'OB-HDN-2026-002', 'OB-HDN-2026-003'] });
    const hodanBlockchainId = await insertIfMissing(
      'SELECT id FROM blockchain_records WHERE entity_type = ? AND entity_id = ?',
      ['station_sample', hodanDistrictId],
      `INSERT INTO blockchain_records
         (entity_type, entity_id, proof_version, sha256_hash, hash_sha256, data_snapshot, created_by)
       VALUES (?, ?, 1, ?, ?, ?, ?)`,
      ['station_sample', hodanDistrictId, hodanBlockchainHash, hodanBlockchainHash, JSON.stringify({ station: 'hodan_district', cases: ['OB-HDN-2026-001', 'OB-HDN-2026-002', 'OB-HDN-2026-003'] }), 'hodan_district']
    );

    await db.query(`
      INSERT INTO case_transfers
        (case_id, from_state_administration_id, from_region_id, from_city_id, from_district_id,
         to_state_administration_id, to_region_id, to_city_id, to_district_id,
         from_officer_id, to_officer_id, transferred_by, transfer_reason, transfer_type, blockchain_record_id)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'hodan_district', 'Forwarded CCTV evidence to CID while station retains district ownership.', 'technical_review', ?
      WHERE NOT EXISTS (SELECT 1 FROM case_transfers WHERE case_id = ? AND transfer_type = 'technical_review')
    `, [
      hodanRobberyCaseId,
      stateId, regionId, cityId, hodanDistrictId,
      stateId, regionId, cityId, hodanDistrictId,
      sergeantOfficerId, inspectorOfficerId, hodanBlockchainId, hodanRobberyCaseId,
    ]);

    const hodanActions = [
      [hodanRobberyCaseId, 'hodan_district', 'CASE_CREATED', 'Hodan station registered robbery complaint and opened OB-HDN-2026-001.', null, 'draft'],
      [hodanRobberyCaseId, 'hodan_district', 'SUSPECT_LINKED', 'Primary robbery suspect linked using witness statement and CCTV.', 'draft', 'under_investigation'],
      [hodanRobberyCaseId, 'hodan_district', 'EVIDENCE_COLLECTED', 'CCTV and phone IMEI report collected into evidence room.', 'under_investigation', 'under_investigation'],
      [hodanRobberyCaseId, 'hodan_district', 'SUSPECT_ARRESTED', 'Robbery suspect arrested at Taleex Junction patrol point.', 'under_investigation', 'under_investigation'],
      [hodanNarcoticsCaseId, 'hodan_district', 'CASE_CREATED', 'Hodan night patrol registered narcotics case.', null, 'under_investigation'],
      [hodanNarcoticsCaseId, 'hodan_district', 'SUSPECT_ARRESTED', 'Narcotics suspect arrested and seizure tagged.', 'under_investigation', 'approved_for_court'],
      [hodanNarcoticsCaseId, 'court_user', 'SENTENCE_UPDATED', 'Court conviction recorded with two year sentence.', 'approved_for_court', 'approved_for_court'],
      [hodanAssaultCaseId, 'hodan_district', 'CASE_CREATED', 'Hodan station registered shop assault complaint.', null, 'draft'],
      [hodanAssaultCaseId, 'court_user', 'CASE_CLOSED', 'Court dismissed complaint after mediation and suspect was released.', 'approved_for_court', 'closed'],
    ];
    for (const action of hodanActions) {
      await db.query(`
        INSERT INTO case_actions (case_id, performed_by, action_type, description, status_before, status_after)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM case_actions WHERE case_id = ? AND action_type = ? AND description = ?
        )
      `, [...action, action[0], action[2], action[3]]);
    }

    await db.query(`
      INSERT INTO audit_logs (user_id, user_email, action, entity_type, entity_id, details, new_data, ip_address, user_agent)
      SELECT 'hodan_district', 'hodan_district', 'SEED_HODAN_STATION_SAMPLE', 'stations', ?, ?, ?, '127.0.0.1', 'seed-script'
      WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'SEED_HODAN_STATION_SAMPLE' AND entity_type = 'stations' AND entity_id = ?)
    `, [
      hodanDistrictId,
      JSON.stringify({ message: 'Seeded complete Hodan district station workflow sample' }),
      JSON.stringify({ station: 'hodan_district', cases: ['OB-HDN-2026-001', 'OB-HDN-2026-002', 'OB-HDN-2026-003'] }),
      hodanDistrictId,
    ]);

    await repairCaseSampleData();
    await seedCourtData();

    console.log('Database seeded successfully.');
    console.log('');
    console.log('Sample login credentials:');
    console.log('  Admin:        admin@police.so       / Admin@123');
    console.log('  Officer:      officer@police.so     / Officer@123');
    console.log('  CID:          cid@police.so         / Cid@123');
    console.log('  State admin:  banadir_admin         / Unit@123');
    console.log('  Region admin: mogadishu_region      / Unit@123');
    console.log('  City admin:   mogadishu_city        / Unit@123');
    console.log('  District:     hodan_district        / Unit@123');
    console.log('  Station:      bakaro_station        / Unit@123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err);
    process.exit(1);
  }
}

seed();
