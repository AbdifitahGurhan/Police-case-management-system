'use strict';

require('dotenv').config({ path: './.env' });
const db = require('../src/config/database');

async function tableExists(tableName) {
  const [rows] = await db.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].count > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return rows[0].count > 0;
}

async function constraintExists(tableName, constraintName) {
  const [rows] = await db.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return rows[0].count > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!(await columnExists(tableName, columnName))) {
    await db.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    console.log(`Added ${tableName}.${columnName}`);
  }
}

async function migrate() {
  try {
    if (!(await tableExists('cases'))) {
      throw new Error('Required table cases does not exist.');
    }
    if (!(await tableExists('criminals'))) {
      throw new Error('Required table criminals does not exist.');
    }

    await db.query(`
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
      )
    `);

    await addColumnIfMissing('case_criminals', 'linked_by_user_id', 'VARCHAR(100) NULL AFTER criminal_id');
    await addColumnIfMissing('case_criminals', 'linked_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER linked_by_user_id');
    await addColumnIfMissing('case_criminals', 'status', "ENUM('active','removed') DEFAULT 'active' AFTER linked_at");
    await addColumnIfMissing('case_criminals', 'role_in_case', 'VARCHAR(150) NULL AFTER status');
    await addColumnIfMissing('case_criminals', 'notes', 'TEXT NULL AFTER role_in_case');
    await addColumnIfMissing('case_criminals', 'added_by', 'VARCHAR(100) NULL AFTER notes');
    await addColumnIfMissing('case_criminals', 'added_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER added_by');

    if (!(await indexExists('case_criminals', 'uq_case_criminal'))) {
      await db.query('ALTER TABLE case_criminals ADD UNIQUE KEY uq_case_criminal (case_id, criminal_id)');
      console.log('Added case_criminals.uq_case_criminal');
    }

    if (!(await constraintExists('case_criminals', 'fk_cc_case'))) {
      await db.query(`
        ALTER TABLE case_criminals
        ADD CONSTRAINT fk_cc_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      `);
      console.log('Added case_criminals.fk_cc_case');
    }

    if (!(await constraintExists('case_criminals', 'fk_cc_criminal'))) {
      await db.query(`
        ALTER TABLE case_criminals
        ADD CONSTRAINT fk_cc_criminal FOREIGN KEY (criminal_id) REFERENCES criminals(id)
      `);
      console.log('Added case_criminals.fk_cc_criminal');
    }

    console.log('case_criminals table is ready.');
    process.exit(0);
  } catch (err) {
    console.error('case_criminals migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
