'use strict';

require('dotenv').config();
const db = require('../src/config/database');

async function run() {
  await db.query(`
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
    )
  `);
  await db.query(`
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
    )
  `);
  console.log('District operations migration completed.');
  await db.pool.end();
}

run().catch(async (error) => { console.error(error.message); await db.pool.end(); process.exit(1); });
