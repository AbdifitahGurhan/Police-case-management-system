'use strict';require('dotenv').config();const db=require('../src/config/database');async function run(){
  try{
    let r;
    [r]=await db.query("SHOW COLUMNS FROM police_officers LIKE 'national_id'");
    if(!r.length) await db.query("ALTER TABLE police_officers ADD COLUMN national_id VARCHAR(100) NULL AFTER email");

    [r]=await db.query("SHOW COLUMNS FROM police_officers LIKE 'department'");
    if(!r.length) await db.query("ALTER TABLE police_officers ADD COLUMN department VARCHAR(150) NULL AFTER national_id");

    [r]=await db.query("SHOW COLUMNS FROM police_officers LIKE 'position'");
    if(!r.length) await db.query("ALTER TABLE police_officers ADD COLUMN position VARCHAR(150) NULL AFTER rank_id");

    [r]=await db.query("SHOW COLUMNS FROM police_officers LIKE 'employment_date'");
    if(!r.length) await db.query("ALTER TABLE police_officers ADD COLUMN employment_date DATE NULL AFTER date_of_birth");

    [r]=await db.query("SHOW COLUMNS FROM police_officers LIKE 'weapons_issued'");
    if(!r.length) await db.query("ALTER TABLE police_officers ADD COLUMN weapons_issued TEXT NULL AFTER profile_image");

    [r]=await db.query("SHOW COLUMNS FROM police_officers LIKE 'blood_group'");
    if(!r.length) await db.query("ALTER TABLE police_officers ADD COLUMN blood_group VARCHAR(10) NULL AFTER weapons_issued");

    [r]=await db.query("SHOW COLUMNS FROM police_officers LIKE 'station_id'");
    if(!r.length) await db.query("ALTER TABLE police_officers ADD COLUMN station_id INT NULL AFTER district_id");

    console.log('Added officer additional fields if missing.');
  }catch(e){console.error(e);}
  await db.pool.end();
}
run().catch(async e=>{console.error(e);await db.pool.end();process.exit(1)});
