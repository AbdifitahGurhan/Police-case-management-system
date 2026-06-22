const { pool } = require('../src/config/database');

async function showCreate() {
  try {
    const [[row]] = await pool.query("SHOW CREATE TABLE case_criminals");
    console.log(row['Create Table']);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await pool.end();
  }
}

showCreate();
