require('dotenv').config({ path: './.env' });
const { pool } = require('../src/config/database');

async function run() {
  console.log("Starting database table rename migration...");
  try {
    // Check if criminals table exists and criminals does not
    const [tables] = await pool.query("SHOW TABLES LIKE 'criminals'");
    const [oldTables] = await pool.query("SHOW TABLES LIKE 'criminals'");

    if (oldTables.length > 0 && tables.length === 0) {
      console.log("Renaming table criminals to criminals...");
      await pool.query("RENAME TABLE criminals TO criminals");
      console.log("Renamed criminals to criminals successfully.");
    } else {
      console.log("criminals table already exists or criminals table does not exist.");
    }

    const [caseCriminals] = await pool.query("SHOW TABLES LIKE 'case_criminals'");
    const [casecriminals] = await pool.query("SHOW TABLES LIKE 'case_criminals'");

    if (casecriminals.length > 0 && caseCriminals.length === 0) {
      console.log("Renaming table case_criminals to case_criminals...");
      await pool.query("RENAME TABLE case_criminals TO case_criminals");
      console.log("Renamed case_criminals to case_criminals successfully.");
    } else {
      console.log("case_criminals table already exists or case_criminals table does not exist.");
    }

    console.log("Database table rename completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
