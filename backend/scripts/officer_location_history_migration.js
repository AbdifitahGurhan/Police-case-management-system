'use strict';

const db = require('../src/config/database');

async function addColumn(name, definition) {
  const [rows] = await db.query("SHOW COLUMNS FROM police_officers LIKE ?", [name]);
  if (!rows.length) await db.query(`ALTER TABLE police_officers ADD COLUMN ${name} ${definition}`);
}

async function run() {
  await addColumn('region_id', 'INT NULL AFTER state_administration_id');
  await addColumn('registration_state_administration_id', 'INT NULL AFTER district_id');
  await addColumn('registration_region_id', 'INT NULL AFTER registration_state_administration_id');
  await addColumn('registration_district_id', 'INT NULL AFTER registration_region_id');

  await db.query(`
    UPDATE police_officers po
    LEFT JOIN districts d ON d.id=po.district_id
    LEFT JOIN regions r ON r.id=COALESCE(po.region_id,d.region_id)
    LEFT JOIN users creator ON creator.username=po.created_by
    SET po.region_id=COALESCE(po.region_id,d.region_id,creator.region_id),
        po.registration_state_administration_id=COALESCE(po.registration_state_administration_id,po.state_administration_id,r.state_administration_id,creator.state_administration_id),
        po.registration_region_id=COALESCE(po.registration_region_id,po.region_id,d.region_id,creator.region_id),
        po.registration_district_id=COALESCE(po.registration_district_id,po.district_id,creator.district_id)
  `);
  await db.query(`UPDATE police_officers po JOIN officer_assignments a ON a.officer_id=po.id AND a.is_current=1 JOIN state_administrations s ON s.id=a.assignment_id SET po.state_administration_id=s.id,po.region_id=NULL,po.district_id=NULL WHERE a.assignment_type='State Administration'`);
  await db.query(`UPDATE police_officers po JOIN officer_assignments a ON a.officer_id=po.id AND a.is_current=1 JOIN regions r ON r.id=a.assignment_id SET po.state_administration_id=r.state_administration_id,po.region_id=r.id,po.district_id=NULL WHERE a.assignment_type='Region'`);
  await db.query(`UPDATE police_officers po JOIN officer_assignments a ON a.officer_id=po.id AND a.is_current=1 JOIN districts d ON d.id=a.assignment_id JOIN regions r ON r.id=d.region_id SET po.state_administration_id=r.state_administration_id,po.region_id=r.id,po.district_id=d.id WHERE a.assignment_type IN ('District','District Station')`);
  console.log('Officer location history migration completed.');
  await db.pool.end();
}

run().catch(async error => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
