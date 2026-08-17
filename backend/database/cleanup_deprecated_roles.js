'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const db = require('../src/config/database');

const ROLES_TO_REMOVE = [
  'officer',
  'taliyaha_saldhiga',
  'police_station_commander',
  'POLICE_STATION_COMMANDER',
  'xeer-ilaaliye',
  'prosecutor',
  'taliyaha-gobolka',
  'region_commander',
  'REGION_COMMANDER',
  'staff',
  'STAFF',
  'taliyaha maamul goboleedka',
  'state_commander',
  'STATE_COMMANDER',
  'ward_commander',
  'garsoore',
  'judge',
  'taliyaha degmada',
  'district_commander',
  'DISTRICT_COMMANDER',
];

async function run() {
  console.log('🔄 Cleaning up deprecated roles from database...');
  try {
    // 1. Check if any users are using these roles
    const [assignedUsers] = await db.query(
      `SELECT u.id, u.username, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE LOWER(r.name) IN (${ROLES_TO_REMOVE.map(() => '?').join(', ')})`,
      ROLES_TO_REMOVE.map(r => r.toLowerCase())
    );

    if (assignedUsers.length > 0) {
      console.warn(`⚠️ Warning: Found ${assignedUsers.length} user(s) assigned to deprecated roles:`, assignedUsers);
    } else {
      console.log('✅ No users currently assigned to deprecated roles.');
    }

    // 2. Delete role_permissions for these roles
    const [rpResult] = await db.query(
      `DELETE FROM role_permissions 
       WHERE role_id IN (
         SELECT id FROM roles WHERE LOWER(name) IN (${ROLES_TO_REMOVE.map(() => '?').join(', ')})
       )`,
      ROLES_TO_REMOVE.map(r => r.toLowerCase())
    );
    console.log(`✅ Deleted ${rpResult.affectedRows || 0} role_permission entries.`);

    // 3. Delete the roles themselves
    const [rResult] = await db.query(
      `DELETE FROM roles 
       WHERE LOWER(name) IN (${ROLES_TO_REMOVE.map(() => '?').join(', ')})`,
      ROLES_TO_REMOVE.map(r => r.toLowerCase())
    );
    console.log(`✅ Deleted ${rResult.affectedRows || 0} deprecated roles from roles table.`);

    // 4. Print remaining active roles
    const [activeRoles] = await db.query('SELECT id, name, description FROM roles ORDER BY id ASC');
    console.log('📋 Remaining Active Roles in Database:');
    activeRoles.forEach(r => console.log(`  - [ID: ${r.id}] ${r.name}: ${r.description || 'N/A'}`));

    console.log('🎉 Deprecated roles cleanup completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error cleaning up deprecated roles:', err);
    process.exit(1);
  }
}

run();
