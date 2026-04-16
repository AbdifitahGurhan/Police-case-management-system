-- ============================================================
-- Web-Based Criminal Case Management System
-- MySQL Database Schema
-- Somalia Police Station Management - 5 Tier Hierarchy
-- ============================================================

DROP DATABASE IF EXISTS police_cms;
CREATE DATABASE IF NOT EXISTS police_cms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE police_cms;

-- ============================================================
-- 1. ROLES & USERS (For Admin, CID, Prosecutor)
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
  ('prosecutor', 'Prosecutor who reviews and decides on cases');

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role_id INT NOT NULL,
  username VARCHAR(150) NOT NULL UNIQUE,
  email VARCHAR(150),
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  is_active TINYINT(1) DEFAULT 1,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS special_users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('ADMIN', 'CID', 'PROSECUTOR', 'COURT', 'JAIL') NOT NULL,
  assigned_unit VARCHAR(255),
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  is_active TINYINT(1) DEFAULT 1
);

-- ============================================================
-- 2. RANKS
-- ============================================================
CREATE TABLE IF NOT EXISTS ranks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rank_name VARCHAR(100) NOT NULL UNIQUE,
  rank_code VARCHAR(30) NOT NULL UNIQUE,
  description TEXT,
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
  gender ENUM('male','female','other') DEFAULT 'male',
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
  commander_officer_id INT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_district_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE CASCADE,
  CONSTRAINT fk_district_commander FOREIGN KEY (commander_officer_id) REFERENCES police_officers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS neighborhoods (
  id INT PRIMARY KEY AUTO_INCREMENT,
  district_id INT NOT NULL,
  neighborhood_name VARCHAR(150) NOT NULL,
  neighborhood_code VARCHAR(50) NOT NULL UNIQUE,
  username VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  commander_officer_id INT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_neighborhood_district FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE,
  CONSTRAINT fk_neighborhood_commander FOREIGN KEY (commander_officer_id) REFERENCES police_officers(id) ON DELETE SET NULL
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
  case_title VARCHAR(255) NOT NULL,
  ob_number VARCHAR(30) NOT NULL UNIQUE,
  description TEXT,
  incident_date DATE,
  incident_location VARCHAR(255),
  status VARCHAR(100) DEFAULT 'DRAFT',
  priority ENUM('low','medium','high','critical') DEFAULT 'medium',
  state_administration_id INT,
  region_id INT,
  city_id INT,
  district_id INT,
  neighborhood_id INT,
  assigned_officer_id INT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_case_state FOREIGN KEY (state_administration_id) REFERENCES state_administrations(id),
  CONSTRAINT fk_case_region FOREIGN KEY (region_id) REFERENCES regions(id),
  CONSTRAINT fk_case_city FOREIGN KEY (city_id) REFERENCES cities(id),
  CONSTRAINT fk_case_district FOREIGN KEY (district_id) REFERENCES districts(id),
  CONSTRAINT fk_case_neighborhood FOREIGN KEY (neighborhood_id) REFERENCES neighborhoods(id),
  CONSTRAINT fk_case_officer FOREIGN KEY (assigned_officer_id) REFERENCES police_officers(id)
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
  from_neighborhood_id INT,
  to_state_administration_id INT,
  to_region_id INT,
  to_city_id INT,
  to_district_id INT,
  to_neighborhood_id INT,
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
  details JSON,
  ip_address VARCHAR(50),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 8. ANCILLARY TABLES (Complainants, Suspects, Victims, Witnesses, Evidence)
-- ============================================================

CREATE TABLE IF NOT EXISTS complainants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('male','female','other') DEFAULT 'male',
  age INT,
  nationality VARCHAR(100) DEFAULT 'Somali',
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  phone VARCHAR(30),
  address TEXT,
  email VARCHAR(150),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suspects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  alias VARCHAR(150),
  gender ENUM('male','female','other') DEFAULT 'male',
  age INT,
  nationality VARCHAR(100) DEFAULT 'Somali',
  id_type VARCHAR(50),
  id_number VARCHAR(100),
  phone VARCHAR(30),
  address TEXT,
  description TEXT,
  photo_url VARCHAR(500),
  is_arrested TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS case_suspects (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  suspect_id INT NOT NULL,
  role_in_case VARCHAR(150),
  notes TEXT,
  added_by VARCHAR(100),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_cs_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_cs_suspect FOREIGN KEY (suspect_id) REFERENCES suspects(id),
  UNIQUE KEY uq_case_suspect (case_id, suspect_id)
);

CREATE TABLE IF NOT EXISTS victims (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(150) NOT NULL,
  gender ENUM('male','female','other') DEFAULT 'male',
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
  gender ENUM('male','female','other') DEFAULT 'male',
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
  arrested_by VARCHAR(100),
  arrest_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  arrest_location VARCHAR(255),
  charges TEXT,
  bail_status ENUM('no_bail','bail_granted','bail_pending') DEFAULT 'no_bail',
  bail_amount DECIMAL(12,2),
  notes TEXT,
  CONSTRAINT fk_ar_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE,
  CONSTRAINT fk_ar_suspect FOREIGN KEY (suspect_id) REFERENCES suspects(id) ON DELETE CASCADE
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

