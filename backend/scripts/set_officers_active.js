'use strict';

const db = require('../src/config/database');

async function run() {
  const [result] = await db.query(
    "UPDATE police_officers SET employment_status = 'active' WHERE LOWER(COALESCE(employment_status, '')) <> 'active'"
  );
  console.log(`Saraakiil active laga dhigay: ${result.affectedRows}`);
  await db.pool.end();
}

run().catch(async (error) => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
