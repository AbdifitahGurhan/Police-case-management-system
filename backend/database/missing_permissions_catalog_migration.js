'use strict';

require('dotenv').config();
const db = require('../src/config/database');

const permissions = [
  ['suspects.view', 'Arag eedaysane'],
  ['suspects.create', 'Abuur eedaysane'],
  ['suspects.update', 'Wax ka beddel eedaysane'],
  ['stations.view', 'Arag Xarumaha Boliiska'],
  ['stations.manage', 'Maamul Xarumaha Boliiska'],
  ['jail.view', 'Arag xabsiga dhexe'],
  ['jail.receive_transfer', 'Qaabil wareejinta xabsiga dhexe'],
  ['jail.assign_cell', 'U qoondee qol xabsiga dhexe'],
  ['jail.medical', 'Maamul caafimaadka maxbuuska'],
  ['jail.visitors', 'Maamul booqdayaasha maxbuuska'],
  ['jail.release_confirm', 'Xaqiiji sii-daynta xabsiga dhexe'],
];

async function run() {
  try {
    for (const [permissionKey, description] of permissions) {
      await db.query(
        `INSERT INTO permissions (permission_key, description)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE description = VALUES(description)`,
        [permissionKey, description]
      );
    }
    await db.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id, granted_by)
      SELECT r.id, p.id, 'missing-permissions-catalog'
      FROM roles r
      JOIN permissions p ON p.permission_key IN ('stations.view', 'stations.manage')
      WHERE LOWER(r.name) = 'admin'
    `);
    await db.query(`
      INSERT IGNORE INTO role_permissions (role_id, permission_id, granted_by)
      SELECT r.id, p.id, 'missing-permissions-catalog'
      FROM roles r
      JOIN permissions p ON p.permission_key = 'stations.view'
      WHERE LOWER(r.name) IN ('state_admin', 'state_commander', 'region_admin', 'region_commander')
    `);
    console.log('Missing permissions catalog migration completed.');
  } finally {
    await db.pool.end();
  }
}

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { run };
