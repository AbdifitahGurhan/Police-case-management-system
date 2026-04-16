const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  const config = {
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: ''
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL server.');
    
    await connection.query('CREATE DATABASE IF NOT EXISTS police_cms;');
    console.log('✅ Database "police_cms" ensured.');
    
    await connection.end();
  } catch (err) {
    console.error('❌ Setup failed:');
    console.error(err);
  }
}

setupDatabase();
