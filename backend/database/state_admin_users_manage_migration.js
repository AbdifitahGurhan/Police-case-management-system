'use strict';

require('dotenv').config();
const db = require('../src/config/database');

async function migrate() {
  await db.query(
    `INSERT INTO permissions(permission_key, description)
     VALUES('users.manage', 'Maamulka isticmaalayaasha')
     ON DUPLICATE KEY UPDATE description = VALUES(description)`
  );

  await db.query(
    `INSERT IGNORE INTO role_permissions(role_id, permission_id, granted_by)
     SELECT r.id, p.id, 'state-admin-users-manage-migration'
     FROM roles r
     JOIN permissions p ON p.permission_key = 'users.manage'
     WHERE LOWER(r.name) = 'state_admin'`
  );

  console.log('State admin users.manage migration completed.');
}

if (require.main === module) {
  migrate()
    .then(() => db.pool.end())
    .catch(async (error) => {
      console.error(error);
      await db.pool.end();
      process.exit(1);
    });
}

module.exports = migrate;
