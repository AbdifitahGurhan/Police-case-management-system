# Somali Police Force Case Management System
## Core Project Blueprint - Part 2: Advanced Relational Database Schemas

This document serves as Part 2 of the comprehensive system blueprint for the Somali Police Force Case Management System, documenting advanced schemas for Incident/Case tracking, CID Investigations, Custody tracking, and Judicial Court integration.

---

## 3. Database Architecture (Part 2)

### 3.4. Cases & Occurrence Book (OB) Management

#### 3.4.1. Occurrence Book Entries Table (`ob_entries`)
Stores initially reported public incidents recorded by OB staff at stations.
```sql
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
  status ENUM('OB_REGISTERED','FORWARDED_FOR_REVIEW','CONVERTED_TO_CASE','CASE_OPENED','CLOSED') DEFAULT 'OB_REGISTERED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ob_user FOREIGN KEY (registered_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_ob_state FOREIGN KEY (state_administration_id) REFERENCES state_administrations(id),
  CONSTRAINT fk_ob_region FOREIGN KEY (region_id) REFERENCES regions(id),
  CONSTRAINT fk_ob_district FOREIGN KEY (district_id) REFERENCES districts(id)
);
```

#### 3.4.2. Cases Table (`cases`)
Defines formalized criminal cases converted from OB entries.
```sql
CREATE TABLE IF NOT EXISTS cases (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_number VARCHAR(50) UNIQUE,
  case_title VARCHAR(255) NOT NULL,
  ob_number VARCHAR(30) NOT NULL UNIQUE,
  ob_entry_id INT,
  original_ob_staff_id INT,
  original_ob_staff_name VARCHAR(150),
  incident_type VARCHAR(100),
  complainant_name VARCHAR(150),
  complainant_phone VARCHAR(30),
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
  CONSTRAINT fk_case_officer FOREIGN KEY (assigned_officer_id) REFERENCES police_officers(id)
);
```

#### 3.4.3. Case Confirmations Table (`case_confirmations`)
Logs district and regional commander approvals.
```sql
CREATE TABLE IF NOT EXISTS case_confirmations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  case_id INT NOT NULL,
  commander_user_id VARCHAR(100) NOT NULL,
  confirmation_status VARCHAR(50),
  comments TEXT,
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_conf_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

#### 3.4.4. Blockchain Verification Records Table (`blockchain_records`)
Maintains SHA-256 chain integrity verification to prevent backend tampering.
```sql
CREATE TABLE IF NOT EXISTS blockchain_records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  proof_version INT NOT NULL DEFAULT 1,
  sha256_hash VARCHAR(64) NOT NULL,
  previous_hash VARCHAR(64),
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.4.5. Case Transfers Table (`case_transfers`)
```sql
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
```

---

### 3.5. Criminal Profiling, Witnesses, & Custody

#### 3.5.1. Complainants Table (`complainants`)
```sql
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
```

#### 3.5.2. Criminals Profile & Biometrics Table (`criminals`)
```sql
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
```

#### 3.5.3. Case Criminal Mappings Table (`case_criminals`)
Stores many-to-many relationship of suspects linked to cases.
```sql
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
```

#### 3.5.4. Evidence Ledger Table (`evidence`)
Tracks collected physical, video, audio, or document submissions.
```sql
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
```

#### 3.5.5. Chain of Custody Table (`chain_of_custody`)
```sql
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
```

#### 3.5.6. Arrest & Sentence Status Table (`arrests`)
```sql
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
```

---

### 3.6. CID (Criminal Investigation Department)

#### 3.6.1. CID Assigned Cases Table (`cid_cases`)
```sql
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
```

#### 3.6.2. CID Crime Scenes Visited Table (`cid_crime_scenes`)
```sql
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
```

---

### 3.7. Prisoner Custody & Releases

#### 3.7.1. Release Approvals Ledger Table (`release_approvals`)
Triggers multiple validation nodes (Admin, Prison warden, and Court review) before generating the final release certificate.
```sql
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
```

---

### 3.8. Legal & Judicial Court Mappings

#### 3.8.1. Court Cases Table (`court_cases`)
Coordinates police transfer tracking into court-specific registers.
```sql
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
  status ENUM('registered', 'awaiting_hearing', 'hearing_scheduled', 'in_trial', 'judgment_issued', 'sentenced', 'appealed', 'closed', 'archived') DEFAULT 'registered',
  created_by VARCHAR(100),
  registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_judge VARCHAR(150),
  assigned_prosecutor VARCHAR(150),
  final_outcome ENUM('convicted', 'acquitted', 'dismissed'),
  closure_reason TEXT,
  closure_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_court_cases_police FOREIGN KEY (police_case_id) REFERENCES cases(id) ON DELETE CASCADE
);
```

#### 3.8.2. Court Hearings Scheduled Table (`court_hearings`)
```sql
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
```
