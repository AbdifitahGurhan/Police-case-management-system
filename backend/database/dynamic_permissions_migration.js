'use strict';
require('dotenv').config();
const db=require('../src/config/database');

const permissions=[
 ['permissions.manage','Maamulka awoodaha'],['roles.manage','Maamulka roles-ka'],['users.manage','Maamulka isticmaalayaasha'],
 ['officers.view','Arag saraakiisha'],['officers.create','Diiwaangeli askari'],['officers.approve','Ansixi askari'],['officers.activate','Hawlgeli askari'],['ranks.manage','Maamulka darajooyinka'],['ranks.assign','Bixi darajo'],
 ['ob.view','Arag OB'],['ob.create','Abuur OB'],['ob.update','Wax ka beddel OB'],['ob.print','Daabac OB'],
 ['cases.view','Arag kiis'],['cases.investigate','Baar kiis'],['evidence.manage','Maamul caddeyn'],
 ['suspects.view','Arag eedaysane'],['suspects.create','Abuur eedaysane'],['suspects.update','Wax ka beddel eedaysane'],['suspects.manage','Maamul eedaysane'],
 ['station_jail.view','Arag xabsiga saldhigga'],['station_jail.intake','Qaabil maxbuus'],['station_jail.assign_cell','U qoondee qol'],
 ['stations.view','Arag Xarumaha Boliiska'],['stations.manage','Maamul Xarumaha Boliiska'],
 ['jail.view','Arag xabsiga dhexe'],['jail.receive_transfer','Qaabil wareejinta xabsiga dhexe'],['jail.assign_cell','U qoondee qol xabsiga dhexe'],['jail.medical','Maamul caafimaadka maxbuuska'],['jail.visitors','Maamul booqdayaasha maxbuuska'],['jail.release_confirm','Xaqiiji sii-daynta xabsiga dhexe'],
 ['officers.update','Wax ka beddel askari'],['officers.delete','Ka saar askari'],['officers.transfer','Wareeji askari'],
 ['locations.view','Arag maamul-goboleedyada iyo degmooyinka'],['locations.manage','Maamul maamul-goboleedyada iyo degmooyinka'],
 ['reports.view','Arag warbixin'],['reports.export','Dhoofso warbixin'],['audit_logs.view','Arag audit log']
];
const grants={
 admin:['*'], sub_admin:['users.manage','officers.view','officers.create','reports.view'],
 state_admin:['officers.view','officers.create','officers.update','officers.delete','officers.transfer','officers.approve','officers.activate','ranks.assign','ranks.manage','reports.view','locations.view','locations.manage','ob.view','cases.view'],
 region_admin:['users.manage','officers.view','officers.create','officers.update','officers.delete','officers.transfer','officers.approve','officers.activate','ob.view','cases.view','reports.view','locations.view','locations.manage','stations.view'],
 district_admin:['users.manage','officers.view','officers.create','officers.update','officers.delete','officers.transfer','ob.view','cases.view','cases.investigate','station_jail.view','reports.view','locations.view'],
 personnel_registry:['officers.view','officers.create'], ob_staff:['ob.view','ob.create','ob.update','ob.print'],
 investigator:['ob.view','cases.view','cases.investigate','evidence.manage','suspects.view','suspects.create','suspects.update','suspects.manage'],
 cid:['ob.view','cases.view','cases.investigate','evidence.manage','suspects.view','suspects.create','suspects.update','suspects.manage','reports.view'], cid_director:['ob.view','cases.view','cases.investigate','evidence.manage','suspects.view','suspects.create','suspects.update','suspects.manage','reports.view'], cid_supervisor:['ob.view','cases.view','cases.investigate','evidence.manage','suspects.view','suspects.create','suspects.update','suspects.manage','reports.view'], cid_officer:['ob.view','cases.view','cases.investigate','evidence.manage','suspects.view','suspects.create','suspects.update','suspects.manage'],
 district_commander:['officers.view','ob.view','cases.view','station_jail.view','reports.view'], police_station_commander:['officers.view','ob.view','cases.view','station_jail.view','reports.view'], region_commander:['officers.view','ob.view','cases.view','reports.view','stations.view'], state_commander:['officers.view','ob.view','cases.view','reports.view'],
 station_jail:['cases.view','station_jail.view','station_jail.intake','station_jail.assign_cell'],
 officer:['ob.view','cases.view','cases.investigate','evidence.manage','suspects.view','suspects.create','suspects.update','suspects.manage'], jail:['cases.view','jail.view','jail.receive_transfer','jail.assign_cell','jail.medical','jail.visitors','jail.release_confirm']
};
async function run(){
 await db.query(`CREATE TABLE IF NOT EXISTS permissions(id INT PRIMARY KEY AUTO_INCREMENT,permission_key VARCHAR(100) NOT NULL UNIQUE,description VARCHAR(255),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
 await db.query(`CREATE TABLE IF NOT EXISTS role_permissions(role_id INT NOT NULL,permission_id INT NOT NULL,granted_by VARCHAR(100),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(role_id,permission_id),CONSTRAINT fk_rp_role FOREIGN KEY(role_id) REFERENCES roles(id) ON DELETE CASCADE,CONSTRAINT fk_rp_permission FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE)`);
 await db.query(`CREATE TABLE IF NOT EXISTS user_permissions(user_id INT NOT NULL,permission_id INT NOT NULL,effect ENUM('ALLOW','DENY') NOT NULL,granted_by VARCHAR(100),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(user_id,permission_id),CONSTRAINT fk_up_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,CONSTRAINT fk_up_permission FOREIGN KEY(permission_id) REFERENCES permissions(id) ON DELETE CASCADE)`);
 await db.query(`CREATE TABLE IF NOT EXISTS permission_change_history(id INT PRIMARY KEY AUTO_INCREMENT,actor VARCHAR(100) NOT NULL,target_type ENUM('ROLE','USER') NOT NULL,target_id INT NOT NULL,permission_key VARCHAR(100) NOT NULL,old_effect TEXT,new_effect TEXT,created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
 await db.query(`ALTER TABLE permission_change_history MODIFY COLUMN old_effect TEXT NULL, MODIFY COLUMN new_effect TEXT NULL`);
 for(const [name,description] of permissions)await db.query('INSERT INTO permissions(permission_key,description) VALUES(?,?) ON DUPLICATE KEY UPDATE description=VALUES(description)',[name,description]);
 for(const role of ['sub_admin','state_admin','region_admin','district_admin','personnel_registry','ob_staff','investigator','station_jail','jail'])await db.query('INSERT INTO roles(name,description) VALUES(?,?) ON DUPLICATE KEY UPDATE description=VALUES(description)',[role,role.replaceAll('_',' ')]);
 for(const [role,keys] of Object.entries(grants)){
  const [[r]]=await db.query('SELECT id FROM roles WHERE LOWER(name)=?',[role]); if(!r)continue;
  await db.query('DELETE FROM role_permissions WHERE role_id=?',[r.id]);
  const expanded=keys.includes('*')?permissions.map(p=>p[0]):keys;
  for(const key of expanded)await db.query('INSERT IGNORE INTO role_permissions(role_id,permission_id,granted_by) SELECT ?,id,? FROM permissions WHERE permission_key=?',[r.id,'migration',key]);
 }
 console.log('Dynamic permissions migration completed.'); await db.pool.end();
}
run().catch(async e=>{console.error(e);await db.pool.end();process.exit(1)});
