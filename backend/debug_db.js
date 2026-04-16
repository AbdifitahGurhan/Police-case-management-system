const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('Testing connection with:');
  console.log(`Host: ${process.env.DB_HOST}`);
  console.log(`User: ${process.env.DB_USER}`);
  console.log(`Port: ${process.env.DB_PORT}`);
  console.log(`Database: ${process.env.DB_NAME}`);

  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });
    console.log('✅ Connection successful!');
    await connection.end();
  } catch (err) {
    console.error('❌ Connection failed:');
    console.error(err);
  }
}

testConnection();
