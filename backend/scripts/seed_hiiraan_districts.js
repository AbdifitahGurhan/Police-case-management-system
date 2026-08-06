'use strict';

const db = require('../src/config/database');
const { ensureHiiraanDistricts } = require('../src/utils/hiiraanDistrictCatalog');

async function run() {
  const [[region]] = await db.query(
    `SELECT r.id FROM regions r
     JOIN state_administrations s ON s.id=r.state_administration_id
     WHERE r.region_name='Hiiraan' AND UPPER(s.state_code)='HSH' LIMIT 1`
  );
  if (!region) throw new Error('Gobolka Hiiraan ee Hirshabelle lama helin.');
  const created = await ensureHiiraanDistricts(db, region.id, 'system_catalog');
  console.log(`Degmooyinka Hiiraan ee lagu daray: ${created}`);
  await db.pool.end();
}

run().catch(async error => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
