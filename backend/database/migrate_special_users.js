// database/migrate_special_users.js
'use strict';

const db = require('../src/config/database');

async function migrate() {
  console.log('🚀 Starting Special Users migration...');
  
  try {
    // 1. Insert court and jail roles
    console.log('Inserting court and jail roles into roles table...');
    await db.query(`
      INSERT INTO roles (name, description) VALUES
      ('court', 'Court system role'),
      ('jail', 'Jail system role')
      ON DUPLICATE KEY UPDATE description = VALUES(description)
    `);

    // Fetch their IDs
    const [[courtRole]] = await db.query('SELECT id FROM roles WHERE name = ?', ['court']);
    const [[jailRole]] = await db.query('SELECT id FROM roles WHERE name = ?', ['jail']);

    if (!courtRole || !jailRole) {
      throw new Error('Failed to retrieve court or jail role IDs after insertion.');
    }

    console.log(`Roles identified: court_id=${courtRole.id}, jail_id=${jailRole.id}`);

    // Check if special_users table exists
    const [tables] = await db.query(
      "SHOW TABLES LIKE 'special_users'"
    );

    if (tables.length > 0) {
      console.log('Retrieving users from special_users table...');
      const [specialUsers] = await db.query('SELECT * FROM special_users');
      console.log(`Found ${specialUsers.length} special users to migrate.`);

      for (const spUser of specialUsers) {
        let roleId = null;
        if (spUser.role.toLowerCase() === 'court') {
          roleId = courtRole.id;
        } else if (spUser.role.toLowerCase() === 'jail') {
          roleId = jailRole.id;
        } else {
          console.log(`Skipping special user "${spUser.username}" with role "${spUser.role}" (non-migratable)`);
          continue;
        }

        // Check if user already exists in users table
        const [[existing]] = await db.query('SELECT id FROM users WHERE username = ?', [spUser.username]);

        if (existing) {
          console.log(`User "${spUser.username}" already exists in users table (ID: ${existing.id}). Updating profile...`);
          await db.query(
            `UPDATE users SET role_id = ?, password_hash = ?, full_name = ?, is_active = ?, status = 'ACTIVE' WHERE id = ?`,
            [roleId, spUser.password_hash, spUser.assigned_unit || spUser.username, spUser.is_active, existing.id]
          );
        } else {
          console.log(`Migrating user "${spUser.username}" to users table...`);
          await db.query(
            `INSERT INTO users 
              (role_id, username, password_hash, full_name, is_active, status, user_type, created_by, created_at)
             VALUES (?, ?, ?, ?, ?, 'ACTIVE', 'STAFF', ?, ?)`,
            [
              roleId,
              spUser.username,
              spUser.password_hash,
              spUser.assigned_unit || spUser.username,
              spUser.is_active,
              spUser.created_by || 'admin',
              spUser.created_at || new Date()
            ]
          );
        }
      }

      // Drop special_users table
      console.log('Dropping special_users table...');
      await db.query('DROP TABLE IF EXISTS special_users');
      console.log('Table special_users dropped successfully.');
    } else {
      console.log('special_users table does not exist or was already dropped. Skipping migration.');
    }

    console.log('✅ Special Users migration completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
