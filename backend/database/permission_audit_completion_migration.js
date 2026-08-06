'use strict';
require('dotenv').config();
const db=require('../src/config/database');

async function run(){
  const permissions=[
    ['officers.update','Wax ka beddel askari'],['officers.delete','Ka saar askari'],['officers.transfer','Wareeji askari'],
    ['locations.view','Arag maamul-goboleedyada iyo degmooyinka'],['locations.manage','Maamul maamul-goboleedyada iyo degmooyinka'],
  ];
  for(const [key,description] of permissions) await db.query(`INSERT INTO permissions(permission_key,description) VALUES(?,?) ON DUPLICATE KEY UPDATE description=VALUES(description)`,[key,description]);
  const grants={admin:permissions.map(item=>item[0]),sub_admin:['officers.update','officers.transfer','locations.view'],state_admin:['officers.update','officers.transfer','locations.view'],region_admin:['officers.transfer','locations.view','locations.manage'],district_admin:['officers.update','officers.transfer','locations.view','cases.investigate']};
  for(const [role,keys] of Object.entries(grants)) for(const key of keys) await db.query(`INSERT IGNORE INTO role_permissions(role_id,permission_id,granted_by) SELECT r.id,p.id,'permission-audit-completion' FROM roles r JOIN permissions p WHERE LOWER(r.name)=? AND p.permission_key=?`,[role,key]);
  const [column]=await db.query(`SHOW COLUMNS FROM audit_logs LIKE 'police_station_id'`);
  if(!column.length) await db.query('ALTER TABLE audit_logs ADD COLUMN police_station_id INT NULL AFTER entity_id');
  console.log('Permission and audit completion migration completed.');
  await db.pool.end();
}
run().catch(async error=>{console.error(error);await db.pool.end();process.exit(1)});
