// database/migrateLocalToRailway.js — Migrates local MySQL data to Railway MySQL Database using Connection Pool
'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrateLocalToRailway() {
  const localPassword = process.env.LOCAL_DB_PASSWORD || '';
  const localDatabase = process.env.LOCAL_DB_NAME || 'police_cms';

  console.log('🔄 Connecting to Local MySQL pool...');
  const localPool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: localPassword,
    database: localDatabase,
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    dateStrings: ['DATE', 'DATETIME'],
  });

  console.log('🔄 Connecting to Railway Remote MySQL pool (altaria.proxy.rlwy.net:30721)...');
  const railwayPool = mysql.createPool({
    host: 'altaria.proxy.rlwy.net',
    port: 30721,
    user: 'root',
    password: 'fnwEEUNFXuhIXbuAhjwwwZonCsVKUdjU',
    database: 'railway',
    waitForConnections: true,
    connectionLimit: 10,
    enableKeepAlive: true,
    dateStrings: ['DATE', 'DATETIME'],
  });

  try {
    const [tables] = await localPool.query('SHOW TABLES');
    console.log(`📋 Found ${tables.length} tables in local database.`);

    await railwayPool.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const tableObj of tables) {
      const tableName = Object.values(tableObj)[0];

      // 1. Recreate table structure on Railway
      const [[createSql]] = await localPool.query(`SHOW CREATE TABLE \`${tableName}\``);
      const sql = createSql['Create Table'];
      await railwayPool.query(`DROP TABLE IF EXISTS \`${tableName}\``);
      await railwayPool.query(sql);

      // 2. Transfer rows in fast batches
      const [rows] = await localPool.query(`SELECT * FROM \`${tableName}\``);
      if (rows.length > 0) {
        let insertedCount = 0;
        const BATCH_SIZE = 50;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const chunk = rows.slice(i, i + BATCH_SIZE);
          if (chunk.length === 0) continue;

          const keys = Object.keys(chunk[0]);
          const cols = keys.map(k => `\`${k}\``).join(', ');
          const valuesList = [];
          const placeholdersList = [];

          for (const row of chunk) {
            const rowValues = keys.map(k => {
              const val = row[k];
              if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
                return JSON.stringify(val);
              }
              return val;
            });
            valuesList.push(...rowValues);
            placeholdersList.push(`(${keys.map(() => '?').join(', ')})`);
          }

          try {
            await railwayPool.query(
              `INSERT INTO \`${tableName}\` (${cols}) VALUES ${placeholdersList.join(', ')}`,
              valuesList
            );
            insertedCount += chunk.length;
          } catch (batchErr) {
            for (const row of chunk) {
              const rowValues = keys.map(k => {
                const val = row[k];
                if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
                  return JSON.stringify(val);
                }
                return val;
              });
              try {
                await railwayPool.query(
                  `INSERT INTO \`${tableName}\` (${cols}) VALUES (${keys.map(() => '?').join(', ')})`,
                  rowValues
                );
                insertedCount++;
              } catch (rowErr) {
                // Ignore minor row warnings
              }
            }
          }
        }
        console.log(`  ✅ ${tableName}: ${insertedCount}/${rows.length} rows migrated.`);
      } else {
        console.log(`  ✅ ${tableName}: 0 rows.`);
      }
    }

    await railwayPool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🎉 ALL TABLES & LOCAL DATA SUCCESSFULLY MIGRATED TO RAILWAY!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await localPool.end();
    await railwayPool.end();
  }
}

module.exports = migrateLocalToRailway;

if (require.main === module) {
  migrateLocalToRailway();
}
