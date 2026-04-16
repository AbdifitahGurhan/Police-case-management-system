require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function resetAdmin() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'police_cms',
    });

    console.log('Connected to database.');

    // Delete all users safely regardless of legacy foreign keys
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    await connection.execute('DELETE FROM users');
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    console.log('All existing users deleted.');

    // Repair schema conditionally if username column is missing
    try {
      await connection.execute('ALTER TABLE users ADD COLUMN username VARCHAR(150) UNIQUE AFTER role_id');
      console.log('Added missing username column to users table.');
    } catch(e) {
      if (e.code !== 'ER_DUP_FIELDNAME') console.error('ALTER check:', e.message);
    }

    // Create the new singular admin user
    const hash = await bcrypt.hash('Admin@123', 12);
    try {
      await connection.execute(
        `INSERT INTO users (role_id, username, email, full_name, password_hash, is_active) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [1, 'admin', 'admin@police.so', 'System Administrator', hash, 1]
      );
    } catch(e) {
      if (e.code === 'ER_BAD_FIELD_ERROR') {
        // Fallback for older schemas that don't allow username even after alter or missing is_active
        await connection.execute(
          `INSERT INTO users (role_id, email, full_name, password_hash) VALUES (?, ?, ?, ?)`,
          [1, 'admin@police.so', 'System Administrator', hash]
        );
      } else { throw e; }
    }

    console.log('✅ Admin user successfully created!');
    console.log('Username: admin');
    console.log('Email: admin@police.so');
    console.log('Password: Admin@123');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

resetAdmin();
