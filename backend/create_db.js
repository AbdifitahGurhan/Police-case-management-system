const mysql = require('mysql2/promise');
require('dotenv').config();

async function setupDatabase() {
  const config = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to MySQL server.');
    
    const dbName = process.env.DB_NAME || 'police_cms';
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    console.log(`✅ Database "${dbName}" ensured.`);
    
    await connection.end();
  } catch (err) {
    console.error('❌ Setup failed:');
    console.error(err);
  }
}

setupDatabase();
