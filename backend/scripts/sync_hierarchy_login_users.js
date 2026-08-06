'use strict';

const db = require('../src/config/database');

async function roleId(name) {
  const [[role]] = await db.query('SELECT id FROM roles WHERE LOWER(name)=? LIMIT 1', [name]);
  if (!role) throw new Error(`Role lama helin: ${name}`);
  return role.id;
}

async function run() {
  const stateRole = await roleId('state_admin');
  const regionRole = await roleId('region_admin');
  const districtRole = await roleId('district_admin');

  await db.query(`INSERT IGNORE INTO users(role_id,username,full_name,password_hash,user_type,assigned_level,state_administration_id,is_commander,is_active,status,created_by)
    SELECT ?,LOWER(username),COALESCE(profile_name,CONCAT(state_name,' Administration')),password_hash,'COMMANDER','STATE',id,1,1,'ACTIVE','hierarchy_sync'
    FROM state_administrations WHERE username IS NOT NULL AND password_hash IS NOT NULL`, [stateRole]);
  await db.query(`INSERT IGNORE INTO users(role_id,username,full_name,password_hash,user_type,assigned_level,state_administration_id,region_id,is_commander,is_active,status,created_by)
    SELECT ?,LOWER(r.username),COALESCE(r.profile_name,CONCAT(r.region_name,' Administration')),r.password_hash,'COMMANDER','REGION',r.state_administration_id,r.id,1,1,'ACTIVE','hierarchy_sync'
    FROM regions r WHERE r.username IS NOT NULL AND r.password_hash IS NOT NULL`, [regionRole]);
  await db.query(`INSERT IGNORE INTO users(role_id,username,full_name,password_hash,user_type,assigned_level,state_administration_id,region_id,district_id,is_commander,is_active,status,created_by)
    SELECT ?,LOWER(d.username),COALESCE(d.profile_name,CONCAT(d.district_name,' Administration')),d.password_hash,'COMMANDER','DISTRICT_POLICE_STATION',r.state_administration_id,r.id,d.id,1,1,'ACTIVE','hierarchy_sync'
    FROM districts d JOIN cities c ON c.id=d.city_id JOIN regions r ON r.id=c.region_id
    WHERE d.username IS NOT NULL AND d.password_hash IS NOT NULL AND COALESCE(d.created_by,'') NOT IN ('system_catalog','hierarchy_sync')`, [districtRole]);

  console.log('Hierarchy login users synced.');
  await db.pool.end();
}

run().catch(async error => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
