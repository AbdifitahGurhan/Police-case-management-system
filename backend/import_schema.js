const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config();

async function importSchema() {
  const config = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true
  };

  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ Connected to police_cms.');
    
    const schema = fs.readFileSync('database/schema.sql', 'utf8');
    await connection.query(schema);
    console.log('✅ Schema imported successfully.');
    
    await connection.end();
  } catch (err) {
    console.error('❌ Import failed:');
    console.error(err);
  }
}

importSchema();
