# Somali Police Force Case Management System
## Core Project Blueprint - Part 1: System Overview, Tech Stack, & Core Schema

This document serves as Part 1 of the comprehensive system blueprint for the Somali Police Force Case Management System. It covers the executive system summary, architectural overview, tech stack, and the initial set of core database schemas.

---

## Table of Contents

- [Somali Police Force Case Management System](#somali-police-force-case-management-system)
  - [Core Project Blueprint - Part 1: System Overview, Tech Stack, \& Core Schema](#core-project-blueprint---part-1-system-overview-tech-stack--core-schema)
  - [Table of Contents](#table-of-contents)
  - [1. Executive Summary \& System Overview](#1-executive-summary--system-overview)
    - [1.1. System Goals](#11-system-goals)
    - [1.2. The 5-Tier Command Hierarchy](#12-the-5-tier-command-hierarchy)
    - [1.3. User Persona and Role Matrices](#13-user-persona-and-role-matrices)
  - [2. Technical Architecture \& Core Tech Stack](#2-technical-architecture--core-tech-stack)
    - [2.1. Backend Tech Stack](#21-backend-tech-stack)
    - [2.2. Frontend Tech Stack](#22-frontend-tech-stack)
    - [2.3. Design System \& Theme Specification](#23-design-system--theme-specification)
  - [3. Database Architecture (Part 1)](#3-database-architecture-part-1)
    - [3.1. Roles \& User Personnel Management](#31-roles--user-personnel-management)
      - [3.1.1. Roles Table (`roles`)](#311-roles-table-roles)
      - [3.1.2. Users Table (`users`)](#312-users-table-users)
      - [3.1.3. Ranks Table (`ranks`)](#313-ranks-table-ranks)
      - [3.1.4. Police Officers Table (`police_officers`)](#314-police-officers-table-police_officers)
    - [3.2. Administrative Division Hierarchy Tables](#32-administrative-division-hierarchy-tables)
      - [3.2.1. State Administrations Table (`state_administrations`)](#321-state-administrations-table-state_administrations)
      - [3.2.2. Regions Table (`regions`)](#322-regions-table-regions)
      - [3.2.3. Cities Table (`cities`)](#323-cities-table-cities)
      - [3.2.4. Districts Table (`districts`)](#324-districts-table-districts)
    - [3.3. Personnel Tracking \& Assignments](#33-personnel-tracking--assignments)
      - [3.3.1. Officer Assignments Table (`officer_assignments`)](#331-officer-assignments-table-officer_assignments)
      - [3.3.2. Officer Transfers Table (`officer_transfers`)](#332-officer-transfers-table-officer_transfers)

---

## 1. Executive Summary & System Overview

### 1.1. System Goals
The Web-Based Case Management System (CMS) is designed for the Somali Police Force to provide a secure, digital pipeline for registering, investigating, tracking, and prosecuting criminal activities. The application digitizes manual Occurrence Book (OB) entries and structures them into official cases. 

### 1.2. The 5-Tier Command Hierarchy
To match national administrative structures, the system implements a robust spatial scoping mechanism spanning:
1. **Federal/National Administration**: Oversees the entire system configuration.
2. **State Administration**: Commands police operations within a specific state.
3. **Regional Administration**: Oversees districts within a specified region.
4. **City/District Administration**: Coordinates station-level reports.
5. **Local Police Station**: Coordinates local patrols, OB entry, and initial case registration.

This structure enforces location-scoped data access, ensuring commanders at specific levels can only view records generated within their jurisdiction.

### 1.3. User Persona and Role Matrices
The system supports distinct user roles:
* **Admin**: Performs administrative controls, rank management, and core database backups.
* **OB Staff (Occurrence Book)**: Registers public complaints, inputs details into the digital ledger, and initiates drafts.
* **Staff/Officer**: Investigates incidents and processes cases.
* **Commanders**: Approve/reject cases, manage officer assignments, and generate station audits.
* **CID (Criminal Investigation Dept)**: Handles high-priority investigations and crime scene analyses.
* **Prosecutors / Court Clerk / Judges**: Manage hearings, legal submissions, and issue court decisions.
* **Jail Custodians**: Coordinate medical records, visitor logs, and release certificates.

---

## 2. Technical Architecture & Core Tech Stack

The application employs a decoupled client-server architecture.

### 2.1. Backend Tech Stack
* **Runtime**: Node.js
* **Framework**: Express.js
* **Database**: MySQL 8 (single data store — MongoDB config exists but is unused/optional, see Part 3B section 5 for details)
* **Connectivity**: `mysql2/promise` (connection pooling, async-await structure)
* **Authentication**: JSON Web Token (JWT) with secure cookies and bcrypt hashing (12 rounds)

### 2.2. Frontend Tech Stack
* **Framework**: Next.js 16 (React 19, Client & Server Component separation)
* **Build System**: Next dev (Turbopack)
* **UI Component Library**: Ant Design (AntD v6)
* **Styling Engine**: Vanilla CSS + TailwindCSS (utilities) + Next Google fonts (Inter)

### 2.3. Design System & Theme Specification
The system supports dual-theme profiles (Light Mode and Dark Mode) with the following attributes:
* **Transition Time**: 200ms ease on colors and backgrounds.
* **Theme Preference Persistence**: Automatically saved to `localStorage` and falls back to system preferences via media query on first visit.
* **Dark Mode Palette**:
  * **Main Background**: `#0E0E0E`
  * **Secondary/Sidebar/Header Background**: `#171717`
  * **Card & Panel Elements**: `#1C1C1C`
  * **Borders & Dividers**: `#2B2B2B`
  * **Primary Text**: `#FFFFFF`
  * **Secondary Text**: `#A5A5A5`
  * **Muted/Placeholder Text**: `#707070`
  * **Highlight Accent**: `#A8FF4D` (used selectively for selections, primary CTA hover states, and active tags)

---

## 3. Database Architecture (Part 1)

### 3.1. Roles & User Personnel Management

#### 3.1.1. Roles Table (`roles`)
Defines permission tiers across the application.
```sql
CREATE TABLE IF NOT EXISTS roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 3.1.2. Users Table (`users`)
Coordinates system authentication and user mappings.
```sql
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
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
);
```

#### 3.1.3. Ranks Table (`ranks`)
Details official police ranks.
```sql
CREATE TABLE IF NOT EXISTS ranks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rank_name VARCHAR(100) NOT NULL UNIQUE,
  rank_code VARCHAR(30) NOT NULL UNIQUE,
  description TEXT,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 3.1.4. Police Officers Table (`police_officers`)
Stores official roster of police personnel.
```sql
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
```

---

### 3.2. Administrative Division Hierarchy Tables

#### 3.2.1. State Administrations Table (`state_administrations`)
```sql
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
```

#### 3.2.2. Regions Table (`regions`)
```sql
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
```

#### 3.2.3. Cities Table (`cities`)
```sql
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
```

#### 3.2.4. Districts Table (`districts`)
```sql
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
```

---

### 3.3. Personnel Tracking & Assignments

#### 3.3.1. Officer Assignments Table (`officer_assignments`)
Tracks current physical status and placement of officers.
```sql
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
```

#### 3.3.2. Officer Transfers Table (`officer_transfers`)
Logs historical transfers of officers between stations.
```sql
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
```
