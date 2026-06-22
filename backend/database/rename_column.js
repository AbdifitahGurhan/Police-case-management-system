require('dotenv').config({ path: './.env' });
const { pool } = require('../src/config/database');

async function run() {
  console.log("Starting column rename migration in case_criminals...");
  try {
    // Check if criminal_id already exists in case_criminals
    const [columns] = await pool.query("DESCRIBE case_criminals");
    const hasCriminalId = columns.some(c => c.Field === 'criminal_id');
    const hasSuspectId = columns.some(c => c.Field === 'suspect_id');

    if (hasSuspectId && !hasCriminalId) {
      console.log("Renaming suspect_id to criminal_id in case_criminals...");
      
      // Step 1: Drop foreign key
      try {
        console.log("Dropping foreign key fk_cs_suspect...");
        await pool.query("ALTER TABLE case_criminals DROP FOREIGN KEY fk_cs_suspect");
      } catch (err) {
        console.log("Note (FK drop):", err.message);
      }

      // Step 2: Drop unique key
      try {
        console.log("Dropping unique key uq_case_suspect...");
        await pool.query("ALTER TABLE case_criminals DROP INDEX uq_case_suspect");
      } catch (err) {
        console.log("Note (Unique key drop):", err.message);
      }

      // Step 3: Drop key index
      try {
        console.log("Dropping key index fk_cs_suspect...");
        await pool.query("ALTER TABLE case_criminals DROP INDEX fk_cs_suspect");
      } catch (err) {
        console.log("Note (Key drop):", err.message);
      }

      // Step 4: Rename column suspect_id to criminal_id
      console.log("Renaming column suspect_id to criminal_id...");
      await pool.query("ALTER TABLE case_criminals CHANGE COLUMN suspect_id criminal_id INT NOT NULL");

      // Step 5: Add unique key uq_case_criminal
      console.log("Adding unique key uq_case_criminal...");
      await pool.query("ALTER TABLE case_criminals ADD UNIQUE KEY uq_case_criminal (case_id, criminal_id)");

      // Step 6: Add foreign key fk_cc_criminal
      console.log("Adding foreign key fk_cc_criminal...");
      await pool.query("ALTER TABLE case_criminals ADD CONSTRAINT fk_cc_criminal FOREIGN KEY (criminal_id) REFERENCES criminals(id)");

      console.log("Column rename completed successfully!");
    } else if (hasCriminalId) {
      console.log("criminal_id already exists in case_criminals table.");
    } else {
      console.log("Neither suspect_id nor criminal_id found in case_criminals table columns.");
    }

    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

run();
