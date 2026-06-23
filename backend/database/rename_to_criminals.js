'use strict';

require('dotenv').config({ path: './.env' });
const { pool } = require('../src/config/database');

async function tableExists(tableName) {
  const [rows] = await pool.query('SHOW TABLES LIKE ?', [tableName]);
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].count > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [tableName, indexName]
  );
  return rows[0].count > 0;
}

async function getForeignKeysForColumn(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
       AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [tableName, columnName]
  );
  return rows.map((row) => row.CONSTRAINT_NAME);
}

async function constraintExists(tableName, constraintName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND CONSTRAINT_NAME = ?`,
    [tableName, constraintName]
  );
  return rows[0].count > 0;
}

async function addColumnIfMissing(tableName, columnName, definition) {
  if (!(await columnExists(tableName, columnName))) {
    await pool.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    console.log(`Added ${tableName}.${columnName}`);
  }
}

async function migrate() {
  try {
    console.log('Starting suspects -> criminals migration...');

    const hasCriminals = await tableExists('criminals');
    const hasSuspects = await tableExists('suspects');
    if (!hasCriminals && hasSuspects) {
      await pool.query('RENAME TABLE suspects TO criminals');
      console.log('Renamed suspects to criminals.');
    } else if (hasCriminals) {
      console.log('criminals table already exists.');
    } else {
      throw new Error('Neither suspects nor criminals table exists.');
    }

    const hasCaseCriminals = await tableExists('case_criminals');
    const hasCaseSuspects = await tableExists('case_suspects');
    if (!hasCaseCriminals && hasCaseSuspects) {
      await pool.query('RENAME TABLE case_suspects TO case_criminals');
      console.log('Renamed case_suspects to case_criminals.');
    } else if (hasCaseCriminals) {
      console.log('case_criminals table already exists.');
    } else {
      await pool.query(`
        CREATE TABLE case_criminals (
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
      console.log('Created case_criminals table.');
    }

    if (await columnExists('case_criminals', 'suspect_id') && !(await columnExists('case_criminals', 'criminal_id'))) {
      const foreignKeys = [
        ...await getForeignKeysForColumn('case_criminals', 'case_id'),
        ...await getForeignKeysForColumn('case_criminals', 'suspect_id'),
      ];
      for (const fk of [...new Set(foreignKeys)]) {
        await pool.query(`ALTER TABLE case_criminals DROP FOREIGN KEY ${fk}`);
        console.log(`Dropped foreign key ${fk}.`);
      }

      if (await indexExists('case_criminals', 'uq_case_suspect')) {
        await pool.query('ALTER TABLE case_criminals DROP INDEX uq_case_suspect');
        console.log('Dropped uq_case_suspect.');
      }

      await pool.query('ALTER TABLE case_criminals CHANGE COLUMN suspect_id criminal_id INT NOT NULL');
      console.log('Renamed case_criminals.suspect_id to criminal_id.');
    }

    await addColumnIfMissing('case_criminals', 'linked_by_user_id', 'VARCHAR(100) NULL AFTER criminal_id');
    await addColumnIfMissing('case_criminals', 'linked_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER linked_by_user_id');
    await addColumnIfMissing('case_criminals', 'status', "ENUM('active','removed') DEFAULT 'active' AFTER linked_at");
    await addColumnIfMissing('case_criminals', 'role_in_case', 'VARCHAR(150) NULL AFTER status');
    await addColumnIfMissing('case_criminals', 'notes', 'TEXT NULL AFTER role_in_case');
    await addColumnIfMissing('case_criminals', 'added_by', 'VARCHAR(100) NULL AFTER notes');
    await addColumnIfMissing('case_criminals', 'added_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER added_by');

    if (!(await indexExists('case_criminals', 'uq_case_criminal'))) {
      await pool.query('ALTER TABLE case_criminals ADD UNIQUE KEY uq_case_criminal (case_id, criminal_id)');
      console.log('Added uq_case_criminal.');
    }

    if (!(await constraintExists('case_criminals', 'fk_cc_case'))) {
      await pool.query(`
        ALTER TABLE case_criminals
        ADD CONSTRAINT fk_cc_case FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
      `);
      console.log('Added fk_cc_case.');
    }

    if (!(await constraintExists('case_criminals', 'fk_cc_criminal'))) {
      await pool.query(`
        ALTER TABLE case_criminals
        ADD CONSTRAINT fk_cc_criminal FOREIGN KEY (criminal_id) REFERENCES criminals(id)
      `);
      console.log('Added fk_cc_criminal.');
    }

    console.log('suspects -> criminals migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
