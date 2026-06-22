const { pool } = require('../src/config/database');

async function check() {
  try {
    const [tables] = await pool.query("SHOW TABLES");
    console.log("Tables in database:", tables);
    
    // Check columns of case_criminals or case_suspects
    for (const tableRow of tables) {
      const tableName = Object.values(tableRow)[0];
      if (['suspects', 'criminals', 'case_suspects', 'case_criminals', 'arrests'].includes(tableName)) {
        const [columns] = await pool.query(`DESCRIBE \`${tableName}\``);
        console.log(`\nColumns of ${tableName}:`);
        console.table(columns.map(c => ({ Field: c.Field, Type: c.Type, Null: c.Null, Key: c.Key })));
      }
    }
  } catch (err) {
    console.error("Error checking db:", err);
  } finally {
    await pool.end();
  }
}

check();
