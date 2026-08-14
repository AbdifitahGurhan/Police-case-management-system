'use strict';

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');

function parseList(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function run() {
  const defaultPassword = process.env.RESET_PASSWORD || 'Temp@123';
  const usernames = parseList(process.env.RESET_USERS);
  const roleNames = parseList(process.env.RESET_ROLES);
  const includeAll = process.env.RESET_ALL === '1' || (usernames.length === 0 && roleNames.length === 0);

  const passwordHash = await bcrypt.hash(defaultPassword, 12);

  const where = [];
  const params = [];

  if (usernames.length) {
    where.push(`u.username IN (${usernames.map(() => '?').join(',')})`);
    params.push(...usernames);
  }

  if (roleNames.length) {
    where.push(`LOWER(r.name) IN (${roleNames.map(() => '?').join(',')})`);
    params.push(...roleNames.map((role) => role.toLowerCase()));
  }

  if (includeAll) {
    where.push('1=1');
  }

  const sql = `
    SELECT u.id, u.username, u.full_name, r.name AS role_name
    FROM users u
    LEFT JOIN roles r ON r.id = u.role_id
    WHERE ${where.join(' OR ')}
    ORDER BY u.id ASC
  `;

  try {
    const [users] = await db.query(sql, params);

    if (!users.length) {
      console.log('No matching users found.');
      return;
    }

    for (const user of users) {
      await db.query(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
        [passwordHash, user.id]
      );
      console.log(`Updated: ${user.username} (${user.role_name || 'unknown role'})`);
    }

    console.log('');
    console.log(`Done. New password for all updated users: ${defaultPassword}`);
    console.log('Tip: set RESET_USERS=username1,username2 or RESET_ROLES=admin,state_admin to scope the reset.');
  } catch (err) {
    console.error('Password reset failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.pool.end();
  }
}

run();
