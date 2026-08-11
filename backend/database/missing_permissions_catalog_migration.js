'use strict';

require('dotenv').config();
const db = require('../src/config/database');

const permissions = [
  ['suspects.view', 'Arag eedaysane'],
  ['suspects.create', 'Abuur eedaysane'],
  ['suspects.update', 'Wax ka beddel eedaysane'],
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
