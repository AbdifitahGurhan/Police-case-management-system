require('dotenv').config({ path: './.env' });
const { pool } = require('./src/config/database');

const run = async () => {
  try {
    await pool.query(`
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
      )
    `);
    console.log("Migration successful");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
