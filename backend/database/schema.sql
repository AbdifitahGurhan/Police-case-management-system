-- ============================================================
-- Web-Based Criminal Case Management System
-- MySQL Database Schema
-- Somalia Police Station Management - 5 Tier Hierarchy
-- ============================================================

DROP DATABASE IF EXISTS police_cms;
CREATE DATABASE IF NOT EXISTS police_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE police_cms;

-- ============================================================
-- 1. ROLES & USERS (For Admin and CID)
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description) VALUES
  ('admin', 'System Administrator with full access'),
  ('cid', 'CID Investigator who handles referred investigations'),
  ('STATE_COMMANDER', 'Commander responsible for one state'),
  ('REGION_COMMANDER', 'Commander responsible for one region'),
  ('DISTRICT_COMMANDER', 'Commander responsible for one district / police station'),
  ('POLICE_STATION_COMMANDER', 'Commander responsible for one district / police station'),
  ('OB_STAFF', 'Occurrence Book staff member'),
  ('STAFF', 'Operational staff member'),
  ('court', 'Court system role'),
  ('judge', 'Court judge role'),
  ('prosecutor', 'Court prosecutor role'),
  ('jail', 'Jail system role')
ON DUPLICATE KEY UPDATE description = VALUES(description);

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_id INT NOT NULL,
  username VARCHAR(150) NOT NULL UNIQUE,
  email VARCHAR(150),
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  phone VARCHAR(30),
  `rank` VARCHAR(100),
  user_type ENUM('COMMANDER','OB_STAFF','STAFF') DEFAULT 'STAFF',
  assigned_level ENUM('ADMINISTRATION','STATE','REGION','DISTRICT_POLICE_STATION') DEFAULT NULL,
  state_administration_id INT,
  region_id INT,
  district_id INT,
  is_commander TINYINT(1) DEFAULT 0,
  status ENUM('ACTIVE','INACTIVE','SUSPENDED') DEFAULT 'ACTIVE',
  profile_image VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  last_login TIMESTAMP NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_users_location (state_administration_id, region_id, district_id),
  INDEX idx_users_type (user_type, assigned_level)
);

-- ============================================================
-- 2. RANKS
-- ============================================================
CREATE TABLE IF NOT EXISTS ranks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rank_name VARCHAR(100) NOT NULL UNIQUE,
  rank_code VARCHAR(30) NOT NULL UNIQUE,
  description TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Note: We define police_officers later to allow foreign key to centers. But wait!
-- Centers have commander_officer_id, which points to police_officers!
-- So we must create police_officers FIRST, before the centers.

-- ============================================================
-- 3. POLICE PERSONNEL
-- ============================================================
CREATE TABLE IF NOT EXISTS police_officers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  force_number VARCHAR(50) NOT NULL UNIQUE,
  rank_id INT,
  phone VARCHAR(30),
  email VARCHAR(150),
  gender ENUM('male','female') DEFAULT 'male',
  date_of_birth DATE,
  address TEXT,
  profile_image VARCHAR(500),
  employment_status ENUM('active','suspended','retired','inactive') DEFAULT 'active',
  created_by VARCHAR(100), 
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_officer_rank FOREIGN KEY (rank_id) REFERENCES ranks(id)
);

-- ============================================================
-- 4. 5-TIER HIERARCHY
-- ============================================================
CREATE TABLE IF NOT EXISTS state_administrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  state_name VARCHAR(150) NOT NULL,
  state_code VARCHAR(50) NOT NULL UNIQUE,
  username VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  profile_name VARCHAR(150),
  profile_image VARCHAR(500),
  commander_officer_id INT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_state_commander FOREIGN KEY (commander_officer_id) REFERENCES police_officers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS regions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  state_administration_id INT NOT NULL,
  region_name VARCHAR(150) NOT NULL,
  region_code VARCHAR(50) NOT NULL UNIQUE,
  username VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  profile_name VARCHAR(150),
  profile_image VARCHAR(500),
  commander_officer_id INT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_region_state FOREIGN KEY (state_administration_id) REFERENCES state_administrations(id) ON DELETE CASCADE,
  CONSTRAINT fk_region_commander FOREIGN KEY (commander_officer_id) REFERENCES police_officers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  region_id INT NOT NULL,
  city_name VARCHAR(150) NOT NULL,
  city_code VARCHAR(50) NOT NULL UNIQUE,
  username VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  profile_name VARCHAR(150),
  profile_image VARCHAR(500),
  commander_officer_id INT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_city_region FOREIGN KEY (region_id) REFERENCES regions(id) ON DELETE CASCADE,
  CONSTRAINT fk_city_commander FOREIGN KEY (commander_officer_id) REFERENCES police_officers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS districts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  city_id INT NOT NULL,
  district_name VARCHAR(150) NOT NULL,
  district_code VARCHAR(50) NOT NULL UNIQUE,
  username VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  profile_name VARCHAR(150),
  profile_image VARCHAR(500),
  commander_officer_id INT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_district_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
  CONSTRAINT fk_district_commander FOREIGN KEY (commander_officer_id) REFERENCES police_officers(id) ON DELETE SET NULL
);

-- ============================================================
-- 5. OFFICER ASSIGNMENTS & TRANSFERS
-- ============================================================
CREATE TABLE IF NOT EXISTS officer_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  officer_id INT NOT NULL,
  assignment_type VARCHAR(100) NOT NULL,
  assignment_id INT,
  is_current TINYINT(1) DEFAULT 1,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by VARCHAR(100),
  remarks TEXT,
  CONSTRAINT fk_assign_officer FOREIGN KEY (officer_id) REFERENCES police_officers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS officer_transfers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  officer_id INT NOT NULL,
  from_assignment_type VARCHAR(100),
  from_assignment_id INT,
  to_assignment_type VARCHAR(100),
  to_assignment_id INT,
  transfer_reason TEXT NOT NULL,
  transferred_by VARCHAR(100),
  transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT,
  CONSTRAINT fk_transfer_officer FOREIGN KEY (officer_id) REFERENCES police_officers(id) ON DELETE CASCADE
);

-- ============================================================
-- 6. CASES & RELATED
-- ============================================================
CREATE TABLE IF NOT EXISTS cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_number VARCHAR(50) UNIQUE,
  case_title VARCHAR(255) NOT NULL,
  ob_number VARCHAR(30) NOT NULL UNIQUE,
  ob_entry_id INT,
  original_ob_staff_id INT,
  original_ob_staff_name VARCHAR(150),
  incident_type VARCHAR(100),
  case_level ENUM('normal','urgent','critical') DEFAULT 'normal',
  complainant_name VARCHAR(150),
  complainant_phone VARCHAR(30),
  complainant_id_type ENUM('National ID','Passport'),
  complainant_id_number VARCHAR(100),
  complainant_email VARCHAR(150),
  complainant_address VARCHAR(255),
  victim_name VARCHAR(150),
  description TEXT,
  incident_date DATETIME,
  incident_location VARCHAR(255),
  status VARCHAR(100) DEFAULT 'DRAFT',
  priority ENUM('low','medium','high','critical') DEFAULT 'medium',
  state_administration_id INT,
  region_id INT,
  city_id INT,
  district_id INT,
  assigned_officer_id INT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_case_state FOREIGN KEY (state_administration_id) REFERENCES state_administrations(id),
  CONSTRAINT fk_case_region FOREIGN KEY (region_id) REFERENCES regions(id),
  CONSTRAINT fk_case_city FOREIGN KEY (city_id) REFERENCES cities(id),
  CONSTRAINT fk_case_district FOREIGN KEY (district_id) REFERENCES districts(id),
  CONSTRAINT fk_case_officer FOREIGN KEY (assigned_officer_id) REFERENCES police_officers(id),
  INDEX idx_case_ob_entry (ob_entry_id),
  INDEX idx_case_original_ob_staff (original_ob_staff_id)
);

CREATE TABLE IF NOT EXISTS ob_entries (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ob_number VARCHAR(50) NOT NULL UNIQUE,
  case_title VARCHAR(255),
  case_type VARCHAR(100),
  court_level VARCHAR(50),
  case_level ENUM('normal','urgent','critical') DEFAULT 'normal',
  incident_type VARCHAR(100) NOT NULL,
  incident_location VARCHAR(255) NOT NULL,
  incident_datetime DATETIME,
  claim_value DECIMAL(15,2),
  description TEXT,
  reported_by VARCHAR(150) NOT NULL,
  reporter_phone VARCHAR(30),
  reporter_gender VARCHAR(30),
  reporter_id_type ENUM('National ID','Passport'),
  reporter_id_number VARCHAR(100),
  reporter_email VARCHAR(150),
  reporter_address VARCHAR(255),
  respondent_name VARCHAR(150),
  respondent_id_type ENUM('National ID','Passport'),
  respondent_id_number VARCHAR(100),
  respondent_phone VARCHAR(30),
  respondent_email VARCHAR(150),
  respondent_address VARCHAR(255),
  registered_by_user_id INT NOT NULL,
  registered_by_name VARCHAR(150) NOT NULL,
  registered_by_role VARCHAR(100) NOT NULL,
  registered_by_rank VARCHAR(100),
  updated_by VARCHAR(100),
  state_administration_id INT,
  region_id INT,
  district_id INT,
  registration_date DATE NOT NULL,
  registration_time TIME NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'REGISTERED',
  resolution_method ENUM('reconciliation','warning','mediation','withdrawal','false_report','general_agreement','agreement','withdrawn','other'),
  resolution_notes TEXT,
  closed_reason TEXT,
  resolution_parties TEXT,
  resolved_by VARCHAR(100),
  resolved_at DATETIME,
  reopen_reason TEXT,
  reopened_by VARCHAR(100),
  reopened_at DATETIME,
  deleted_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ob_user FOREIGN KEY (registered_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_ob_state FOREIGN KEY (state_administration_id) REFERENCES state_administrations(id),
  CONSTRAINT fk_ob_region FOREIGN KEY (region_id) REFERENCES regions(id),
  CONSTRAINT fk_ob_district FOREIGN KEY (district_id) REFERENCES districts(id),
  INDEX idx_ob_registered_by (registered_by_user_id),
  INDEX idx_ob_location (state_administration_id, region_id, district_id)
);

CREATE TABLE IF NOT EXISTS ob_victims (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ob_entry_id INT NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  details TEXT NOT NULL,
  address TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ob_victim_entry FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id),
  INDEX idx_ob_victim_entry (ob_entry_id)
);

CREATE TABLE IF NOT EXISTS ob_accused (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ob_entry_id INT NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30), id_type VARCHAR(50), id_number VARCHAR(100), gender VARCHAR(20), address TEXT,
  description TEXT, identifying_information TEXT,
  custody_state ENUM('IN_CUSTODY','NOT_IN_CUSTODY') NOT NULL DEFAULT 'NOT_IN_CUSTODY',
  status VARCHAR(40) NOT NULL DEFAULT 'WANTED',
  arrest_date DATETIME, arrest_location VARCHAR(255), arresting_officer VARCHAR(150), tracing_sent_at DATETIME,
  custody_ready TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(100), updated_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ob_accused_entry FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id),
  INDEX idx_ob_accused_entry (ob_entry_id), INDEX idx_ob_accused_search (full_name, phone, id_number)
);

CREATE TABLE IF NOT EXISTS ob_accused_status_history (
  id INT PRIMARY KEY AUTO_INCREMENT, ob_entry_id INT NOT NULL, accused_id INT NOT NULL,
  previous_status VARCHAR(40), new_status VARCHAR(40) NOT NULL, action VARCHAR(80) NOT NULL,
  notes TEXT, performed_by VARCHAR(100) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ob_ash_entry FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id),
  CONSTRAINT fk_ob_ash_accused FOREIGN KEY (accused_id) REFERENCES ob_accused(id),
  INDEX idx_ob_ash_accused (accused_id)
);

CREATE TABLE IF NOT EXISTS ob_status_history (
  id INT PRIMARY KEY AUTO_INCREMENT, ob_entry_id INT NOT NULL, previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL, reason TEXT, performed_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ob_status_entry FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id),
  INDEX idx_ob_status_entry (ob_entry_id)
);

CREATE TABLE IF NOT EXISTS login_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(100),
  username VARCHAR(150),
  success TINYINT(1) NOT NULL DEFAULT 0,
  failure_reason VARCHAR(255),
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_confirmations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  commander_user_id VARCHAR(100) NOT NULL,
  confirmation_status VARCHAR(50),
  comments TEXT,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conf_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS blockchain_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  proof_version INT NOT NULL DEFAULT 1,
  sha256_hash VARCHAR(64) NOT NULL,
  previous_hash VARCHAR(64),
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_blockchain_entity (entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS case_transfers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  from_state_administration_id INT,
  from_region_id INT,
  from_city_id INT,
  from_district_id INT,
  to_state_administration_id INT,
  to_region_id INT,
  to_city_id INT,
  to_district_id INT,
  from_officer_id INT,
  to_officer_id INT,
  transferred_by VARCHAR(100),
  transfer_reason TEXT NOT NULL,
  transfer_type VARCHAR(50) NOT NULL,
  transferred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  blockchain_record_id INT,
  CONSTRAINT fk_ctrans_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_ctrans_bc FOREIGN KEY (blockchain_record_id) REFERENCES blockchain_records(id)
);

-- ============================================================
-- 7. AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(100),
  user_email VARCHAR(150),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id INT,
  police_station_id INT,
  details JSON,
  old_data JSON,
  new_data JSON,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_created_at (created_at)
);

-- ============================================================
-- 8. ANCILLARY TABLES (Complainants, criminals, Victims, Witnesses, Evidence)
-- ============================================================

CREATE TABLE IF NOT EXISTS complainants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('male','female') DEFAULT 'male',
  age INT,
  nationality VARCHAR(100) DEFAULT 'Somali',
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  phone VARCHAR(30),
  address TEXT,
  email VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS criminals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  mother_name VARCHAR(150),
  alias VARCHAR(150),
  gender ENUM('male','female') DEFAULT 'male',
  date_of_birth DATE,
  age INT,
  nationality VARCHAR(100) DEFAULT 'Somali',
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  phone VARCHAR(30),
  address TEXT,
  description TEXT,
  photo_url VARCHAR(500),
  offender_photo VARCHAR(500),
  face_capture_image VARCHAR(500),
  face_capture_notes TEXT,
  profile_notes TEXT,
  arrest_status ENUM('not_arrested','arrested','released','wanted') DEFAULT 'not_arrested',
  fingerprint_hash VARCHAR(255),
  biometric_notes TEXT,
  is_arrested TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_criminals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  criminal_id INT NOT NULL,
  linked_by_user_id VARCHAR(100),
  linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('active','removed') DEFAULT 'active',
  role_in_case VARCHAR(150),
  notes TEXT,
  added_by VARCHAR(100),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cc_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_cc_criminal FOREIGN KEY (criminal_id) REFERENCES criminals(id),
  UNIQUE KEY uq_case_criminal (case_id, criminal_id)
);

CREATE TABLE IF NOT EXISTS victims (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('male','female') DEFAULT 'male',
  age INT,
  nationality VARCHAR(100) DEFAULT 'Somali',
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  phone VARCHAR(30),
  address TEXT,
  injury_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_victims (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  victim_id INT NOT NULL,
  notes TEXT,
  added_by VARCHAR(100),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cv_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_cv_victim FOREIGN KEY (victim_id) REFERENCES victims(id),
  UNIQUE KEY uq_case_victim (case_id, victim_id)
);

CREATE TABLE IF NOT EXISTS witnesses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('male','female') DEFAULT 'male',
  age INT,
  phone VARCHAR(30),
  address TEXT,
  relationship_to_case VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS witness_statements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  witness_id INT NOT NULL,
  statement TEXT NOT NULL,
  statement_date DATE,
  taken_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ws_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_ws_witness FOREIGN KEY (witness_id) REFERENCES witnesses(id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  evidence_number VARCHAR(50) NOT NULL UNIQUE,
  type ENUM('document','photo','video','audio','physical','other') DEFAULT 'document',
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_url VARCHAR(500),
  file_size BIGINT,
  mime_type VARCHAR(100),
  collected_by VARCHAR(100),
  collection_date DATE,
  location_found VARCHAR(255),
  status ENUM('collected','analyzed','submitted','returned') DEFAULT 'collected',
  hash_sha256 VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ev_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chain_of_custody (
  id INT PRIMARY KEY AUTO_INCREMENT,
  evidence_id INT NOT NULL,
  transferred_from VARCHAR(100),
  transferred_to VARCHAR(100) NOT NULL,
  transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reason TEXT,
  location VARCHAR(255),
  notes TEXT,
  CONSTRAINT fk_coc_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS arrests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  suspect_id INT NOT NULL,
  police_station_id INT,
  arrested_by VARCHAR(100),
  arrest_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  arrest_location VARCHAR(255),
  charges TEXT,
  court_decision ENUM('pending','convicted','acquitted','dismissed','adjourned') DEFAULT 'pending',
  court_decision_notes TEXT,
  sentence_period_value INT,
  sentence_period_unit ENUM('days','months','years'),
  sentence_start_date DATE,
  expected_release_date DATE,
  actual_release_date DATE,
  sentence_status ENUM('awaiting_trial','sentenced','serving','release_review','completed','released','wanted','escaped','acquitted','dismissed') DEFAULT 'awaiting_trial',
  final_status VARCHAR(100),
  bail_status ENUM('no_bail','bail_granted','bail_pending') DEFAULT 'no_bail',
  bail_amount DECIMAL(12,2),
  notes TEXT,
  CONSTRAINT fk_ar_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_station FOREIGN KEY (police_station_id) REFERENCES districts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS case_actions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  performed_by VARCHAR(100),
  action_type VARCHAR(100) NOT NULL,
  description TEXT,
  status_before VARCHAR(100),
  status_after VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ca_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS referrals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  referred_by VARCHAR(100),
  referred_to_role VARCHAR(50), 
  referred_to_user VARCHAR(100),
  reason TEXT,
  notes TEXT,
  status ENUM('pending','accepted','rejected','completed') DEFAULT 'pending',
  response TEXT,
  referred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  CONSTRAINT fk_ref_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cid_cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  police_case_id INT NOT NULL UNIQUE,
  case_number VARCHAR(50) NOT NULL,
  ob_number VARCHAR(50),
  case_title VARCHAR(255),
  crime_category VARCHAR(150),
  priority ENUM('low','medium','high','critical') DEFAULT 'medium',
  assigned_officer VARCHAR(150),
  assigned_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  supervisor VARCHAR(150),
  assignment_status ENUM('assigned','accepted','reassigned','rejected') DEFAULT 'assigned',
  investigation_status ENUM('open','under_investigation','evidence_collection','witness_interviews','suspect_tracking','arrest_made','investigation_completed','supervisor_review','approved','rejected','sent_to_prosecutor','sent_to_court') DEFAULT 'open',
  investigation_started_at TIMESTAMP NULL,
  findings TEXT,
  recommendations TEXT,
  supervisor_notes TEXT,
  prosecutor_forwarded_at TIMESTAMP NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_cid_case_police FOREIGN KEY (police_case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cid_progress_notes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cid_case_id INT NOT NULL,
  note TEXT NOT NULL,
  status VARCHAR(100),
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cid_progress_case FOREIGN KEY (cid_case_id) REFERENCES cid_cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cid_crime_scenes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cid_case_id INT NOT NULL,
  location VARCHAR(255) NOT NULL,
  date_visited DATE,
  officer VARCHAR(150),
  observations TEXT,
  scene_photos TEXT,
  collected_evidence TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cid_scene_case FOREIGN KEY (cid_case_id) REFERENCES cid_cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cid_reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  cid_case_id INT NOT NULL,
  report_title VARCHAR(255) NOT NULL,
  case_summary TEXT,
  activities TEXT,
  evidence_summary TEXT,
  witness_summary TEXT,
  suspect_analysis TEXT,
  findings TEXT NOT NULL,
  recommendations TEXT,
  submitted_by VARCHAR(100),
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cid_report_case FOREIGN KEY (cid_case_id) REFERENCES cid_cases(id) ON DELETE CASCADE
);

-- ============================================================
-- 9. PRISONER CUSTODY MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS biometric_identifiers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  suspect_id INT NOT NULL,
  biometric_type ENUM('fingerprint','face','iris','other') NOT NULL,
  biometric_hash VARCHAR(255) NOT NULL,
  quality_score DECIMAL(5,2),
  captured_by VARCHAR(100),
  captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  CONSTRAINT fk_bio_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE,
  UNIQUE KEY uq_biometric_type_hash (biometric_type, biometric_hash)
);

CREATE TABLE IF NOT EXISTS prisoner_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  suspect_id INT NOT NULL,
  arrest_id INT,
  document_type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_url VARCHAR(500),
  file_hash VARCHAR(64),
  uploaded_by VARCHAR(100),
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  CONSTRAINT fk_doc_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE,
  CONSTRAINT fk_doc_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prison_transfers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  suspect_id INT NOT NULL,
  arrest_id INT,
  from_facility VARCHAR(255),
  to_facility VARCHAR(255) NOT NULL,
  transfer_reason TEXT NOT NULL,
  transfer_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  authorized_by VARCHAR(100),
  status ENUM('pending','completed','cancelled') DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ptr_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE,
  CONSTRAINT fk_ptr_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prisoner_medical_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  suspect_id INT NOT NULL,
  arrest_id INT,
  record_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  condition_summary TEXT NOT NULL,
  treatment_given TEXT,
  doctor_name VARCHAR(150),
  facility VARCHAR(255),
  fitness_status ENUM('fit','needs_treatment','hospitalized','critical') DEFAULT 'fit',
  recorded_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_med_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE,
  CONSTRAINT fk_med_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prisoner_visitor_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  suspect_id INT NOT NULL,
  arrest_id INT,
  visitor_name VARCHAR(150) NOT NULL,
  visitor_id_number VARCHAR(100),
  relationship VARCHAR(100),
  visit_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  purpose TEXT,
  approved_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_vis_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE,
  CONSTRAINT fk_vis_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS release_approvals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  suspect_id INT NOT NULL,
  arrest_id INT NOT NULL,
  requested_by VARCHAR(100),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  request_reason TEXT NOT NULL,
  status ENUM('pending','approved','pending_admin_review','admin_reviewed','prison_confirmed','court_approved','certificate_generated','released','rejected') DEFAULT 'pending_admin_review',
  admin_reviewed_by VARCHAR(100),
  admin_reviewed_at TIMESTAMP NULL,
  admin_review_notes TEXT,
  prison_confirmed_by VARCHAR(100),
  prison_confirmed_at TIMESTAMP NULL,
  prison_confirmation_notes TEXT,
  court_approved_by VARCHAR(100),
  court_approved_at TIMESTAMP NULL,
  court_approval_notes TEXT,
  certificate_number VARCHAR(80),
  certificate_issued_by VARCHAR(100),
  certificate_issued_at TIMESTAMP NULL,
  certificate_notes TEXT,
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMP NULL,
  review_notes TEXT,
  CONSTRAINT fk_rel_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE,
  CONSTRAINT fk_rel_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE CASCADE
);

-- =========================================================================
-- COURT SYSTEM TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS court_cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  court_case_number VARCHAR(50) NOT NULL UNIQUE,
  police_case_id INT NOT NULL,
  police_case_number VARCHAR(50),
  ob_number VARCHAR(50),
  case_title VARCHAR(255),
  crime_category VARCHAR(100),
  case_description TEXT,
  source_status VARCHAR(50),
  status ENUM('court_received', 'arraignment', 'remand_investigation', 'remanded_to_investigator', 'returned_from_remand', 'assigned_legal_team', 'case_scheduled', 'trial_hearing', 'evidence_defense', 'judgment', 'sentenced', 'appealed', 'closed', 'archived') DEFAULT 'court_received',
  created_by VARCHAR(100),
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_judge VARCHAR(150),
  assigned_prosecutor VARCHAR(150),
  final_outcome ENUM('convicted', 'acquitted', 'dismissed'),
  closure_reason TEXT,
  closure_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_court_cases_police FOREIGN KEY (police_case_id) REFERENCES cases(id) ON DELETE CASCADE,
  UNIQUE KEY uq_court_case_police_case (police_case_id)
);

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
  CONSTRAINT fk_arraignment_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE,
  INDEX idx_court_arraignments_case (court_case_id),
  INDEX idx_court_arraignments_date (arraignment_date)
);

CREATE TABLE IF NOT EXISTS officer_attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  officer_id INT NOT NULL,
  district_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  shift ENUM('morning','afternoon','night') NOT NULL,
  status ENUM('present','absent','leave','patrol') NOT NULL DEFAULT 'present',
  notes TEXT,
  recorded_by VARCHAR(100),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_officer_attendance (officer_id, attendance_date, shift),
  CONSTRAINT fk_attendance_officer FOREIGN KEY (officer_id) REFERENCES police_officers(id) ON DELETE CASCADE,
  CONSTRAINT fk_attendance_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ob_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ob_entry_id INT NOT NULL,
  attachment_type ENUM('evidence','resolution') DEFAULT 'evidence',
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(100),
  file_size BIGINT,
  uploaded_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ob_attachment FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ob_resolution_documents (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ob_entry_id INT NOT NULL,
  document_type ENUM('reconciliation','warning','mediation','withdrawal','false_report','general_agreement') NOT NULL,
  document_title VARCHAR(255) NOT NULL,
  document_data JSON NOT NULL,
  official_html LONGTEXT NOT NULL,
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ob_resolution_document FOREIGN KEY (ob_entry_id) REFERENCES ob_entries(id) ON DELETE CASCADE,
  INDEX idx_ob_resolution_document (ob_entry_id, created_at)
);

CREATE TABLE IF NOT EXISTS district_complaints (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reference_number VARCHAR(50) NOT NULL UNIQUE,
  district_id INT NOT NULL,
  complainant_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  category VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(255),
  priority ENUM('low','medium','high','critical') DEFAULT 'medium',
  claim_value DECIMAL(15,2),
  status ENUM('new','assigned','in_progress','resolved','closed','escalated') DEFAULT 'new',
  assigned_officer_id INT,
  response_deadline DATETIME,
  resolution_notes TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_complaint_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE,
  CONSTRAINT fk_complaint_officer FOREIGN KEY (assigned_officer_id) REFERENCES police_officers(id) ON DELETE SET NULL,
  INDEX idx_complaint_district_status (district_id, status),
  INDEX idx_complaint_deadline (response_deadline)
);

CREATE TABLE IF NOT EXISTS prison_cells (
  id INT PRIMARY KEY AUTO_INCREMENT,
  facility VARCHAR(150) NOT NULL,
  block_name VARCHAR(50) NOT NULL,
  cell_number VARCHAR(50) NOT NULL,
  capacity INT NOT NULL DEFAULT 4,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prison_cell (facility, block_name, cell_number)
);

CREATE TABLE IF NOT EXISTS prison_admissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  arrest_id INT NOT NULL,
  suspect_id INT NOT NULL,
  prison_number VARCHAR(50) NOT NULL UNIQUE,
  facility VARCHAR(150) NOT NULL,
  admission_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('admitted','discharged') DEFAULT 'admitted',
  admitted_by VARCHAR(100),
  notes TEXT,
  photo_url VARCHAR(500),
  commitment_warrant_url VARCHAR(500),
  property_inventory JSON,
  confirmed_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_active_arrest_admission (arrest_id),
  CONSTRAINT fk_admission_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE CASCADE,
  CONSTRAINT fk_admission_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prison_cell_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admission_id INT NOT NULL,
  facility VARCHAR(150) NOT NULL,
  block_name VARCHAR(50) NOT NULL,
  cell_number VARCHAR(50) NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME NULL,
  assigned_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cell_assignment_admission FOREIGN KEY (admission_id) REFERENCES prison_admissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prison_roll_calls (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admission_id INT NOT NULL,
  roll_date DATE NOT NULL,
  shift ENUM('morning','afternoon','night') NOT NULL,
  status ENUM('present','absent','hospital','court','transfer') NOT NULL DEFAULT 'present',
  notes TEXT,
  recorded_by VARCHAR(100),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admission_roll_call (admission_id, roll_date, shift),
  CONSTRAINT fk_roll_call_admission FOREIGN KEY (admission_id) REFERENCES prison_admissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS court_hearings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  court_case_id INT NOT NULL,
  hearing_type VARCHAR(100) NOT NULL,
  hearing_date DATE NOT NULL,
  hearing_time TIME NOT NULL,
  court_room VARCHAR(50),
  assigned_judge VARCHAR(150),
  status ENUM('scheduled', 'completed', 'cancelled') DEFAULT 'scheduled',
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_hearings_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS court_witnesses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  court_case_id INT NOT NULL,
  witness_id INT NOT NULL,
  status ENUM('summoned', 'present', 'absent') DEFAULT 'summoned',
  testimony TEXT,
  signed_statement_url VARCHAR(500),
  summoned_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_court_witness_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_court_witness_witness FOREIGN KEY (witness_id) REFERENCES witnesses(id) ON DELETE CASCADE
);

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
  CONSTRAINT fk_remand_station FOREIGN KEY (sent_to_station_id) REFERENCES districts(id) ON DELETE SET NULL,
  INDEX idx_court_remands_court_case (court_case_id),
  INDEX idx_court_remands_police_case (police_case_id),
  INDEX idx_court_remands_status (status),
  INDEX idx_court_remands_sent_to_user (sent_to_user_id),
  INDEX idx_court_remands_station (sent_to_station_id)
);

CREATE TABLE IF NOT EXISTS court_evidence_notes (
  court_case_id INT NOT NULL,
  evidence_id INT NOT NULL,
  notes TEXT,
  PRIMARY KEY (court_case_id, evidence_id),
  CONSTRAINT fk_court_ev_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_court_ev_evidence FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS court_proceedings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  court_case_id INT NOT NULL,
  hearing_id INT NOT NULL,
  proceeding_date DATE NOT NULL,
  notes TEXT,
  judge_remarks TEXT,
  prosecutor_remarks TEXT,
  defense_remarks TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proc_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_proc_hearing FOREIGN KEY (hearing_id) REFERENCES court_hearings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS court_judgments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  court_case_id INT NOT NULL,
  judge_name VARCHAR(150),
  decision_date DATE NOT NULL,
  decision_type ENUM('convicted', 'acquitted', 'dismissed') NOT NULL,
  judgment_summary TEXT NOT NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_judg_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS court_sentences (
  id INT PRIMARY KEY AUTO_INCREMENT,
  court_case_id INT NOT NULL,
  criminal_id INT NOT NULL,
  sentence_type ENUM('imprisonment','fine','both') NOT NULL,
  duration VARCHAR(100),
  fine_amount DECIMAL(15,2),
  sentence_date DATE NOT NULL,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sent_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_sent_criminal FOREIGN KEY (criminal_id) REFERENCES criminals(id)
);

CREATE TABLE IF NOT EXISTS court_appeals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  court_case_id INT NOT NULL,
  filed_by VARCHAR(150) NOT NULL,
  appeal_reason TEXT NOT NULL,
  filing_date DATE NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_app_case FOREIGN KEY (court_case_id) REFERENCES court_cases(id) ON DELETE CASCADE
);

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
);

-- ============================================================
-- 12. PRISON / JAIL MANAGEMENT
-- ============================================================
CREATE TABLE IF NOT EXISTS prison_cells (
  id INT PRIMARY KEY AUTO_INCREMENT,
  facility VARCHAR(150) NOT NULL,
  block_name VARCHAR(50) NOT NULL,
  cell_number VARCHAR(50) NOT NULL,
  capacity INT NOT NULL DEFAULT 4,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_prison_cell (facility, block_name, cell_number)
);

CREATE TABLE IF NOT EXISTS prison_admissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  arrest_id INT NOT NULL,
  suspect_id INT NOT NULL,
  prison_number VARCHAR(50) NOT NULL UNIQUE,
  facility VARCHAR(150) NOT NULL,
  admission_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('admitted','discharged') DEFAULT 'admitted',
  admitted_by VARCHAR(100),
  photo_url VARCHAR(500) NULL,
  commitment_warrant_url VARCHAR(500) NULL,
  property_inventory JSON NULL,
  confirmed_at DATETIME NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_active_arrest_admission (arrest_id),
  CONSTRAINT fk_admission_arrest FOREIGN KEY (arrest_id) REFERENCES arrests(id) ON DELETE CASCADE,
  CONSTRAINT fk_admission_suspect FOREIGN KEY (suspect_id) REFERENCES criminals(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prison_cell_assignments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admission_id INT NOT NULL,
  facility VARCHAR(150) NOT NULL,
  block_name VARCHAR(50) NOT NULL,
  cell_number VARCHAR(50) NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME NULL,
  assigned_by VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cell_assignment_admission FOREIGN KEY (admission_id) REFERENCES prison_admissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS prison_roll_calls (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admission_id INT NOT NULL,
  roll_date DATE NOT NULL,
  shift ENUM('morning','afternoon','night') NOT NULL,
  status ENUM('present','absent','hospital','court','transfer') NOT NULL DEFAULT 'present',
  notes TEXT,
  recorded_by VARCHAR(100),
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admission_roll_call (admission_id, roll_date, shift),
  CONSTRAINT fk_roll_call_admission FOREIGN KEY (admission_id) REFERENCES prison_admissions(id) ON DELETE CASCADE
);



