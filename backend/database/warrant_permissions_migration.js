'use strict';
require('dotenv').config();
const db = require('../src/config/database');

const permissions = [
  ['warrants.view', 'Arag garannada maxkamadda'],
  ['warrants.create', 'Bixi garan cusub'],
  ['warrants.update', 'Wax ka beddel garan'],
  ['warrants.execute', 'Fulinta garan'],
  ['warrants.cancel', 'Jooji garan'],
  ['warrants.print', 'Daabac garan'],
];

const warrantRoles = [
  'admin',
  'court',
  'court_admin',
  'court_clerk',
  'judge',
  'prosecutor',
  'prosecutor_liaison',
  'officer',
  'cid',
  'cid_director',
  'cid_supervisor',
  'cid_officer',
  'district_admin',
  'district_commander',
  'police_station_commander',
];

const courtRoles = [
  'court',
  'court_admin',
  'court_clerk',
  'judge',
  'prosecutor',
  'prosecutor_liaison',
];

async function run() {
  for (const [key, description] of permissions) {
    await db.query(
      `INSERT INTO permissions(permission_key, description)
       VALUES(?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [key, description]
    );
  }

  for (const role of warrantRoles) {
    for (const [key] of permissions) {
      await db.query(
        `INSERT IGNORE INTO role_permissions(role_id, permission_id, granted_by)
         SELECT r.id, p.id, 'warrant-permissions-migration'
         FROM roles r
         JOIN permissions p ON p.permission_key = ?
         WHERE LOWER(r.name) = ?`,
        [key, role]
      );
    }
  }

  await db.query(
    `DELETE rp FROM role_permissions rp
     JOIN roles r ON r.id = rp.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE LOWER(r.name) IN (${courtRoles.map(() => '?').join(',')})
       AND p.permission_key = 'ob.view'`,
    courtRoles
  );

  console.log('Warrant permissions migration completed.');
  await db.pool.end();
}

run().catch(async (error) => {
  console.error(error);
  await db.pool.end();
  process.exit(1);
});
