'use strict';

const bcrypt = require('bcryptjs');

const HIIRAAN_DISTRICTS = [
  ['Beledweyne', 'HIR-BLW'], ['Buulo Burte', 'HIR-BBT'], ['Jalalaqsi', 'HIR-JLL'],
  ['Matabaan', 'HIR-MTB'], ['Maxaas', 'HIR-MXS'], ['Halgan', 'HIR-HLG'],
  ['Ceel-Cali', 'HIR-CCA'], ['Far-Libaax', 'HIR-FLB'], ['Moqokori', 'HIR-MQK'],
  ['Buq-Aqable', 'HIR-BQA'], ['Booco/Burweyn', 'HIR-BBW'], ['Cali-Gaduud', 'HIR-CGD'],
  ['Raage-Ceelle', 'HIR-RCL'], ['Xawaadley', 'HIR-XWD'],
];

async function ensureHiiraanDistricts(database, regionId, createdBy = 'system') {
  const [[region]] = await database.query('SELECT id,region_name,region_code FROM regions WHERE id=?', [regionId]);
  if (!region || region.region_name !== 'Hiiraan') return 0;

  let [[city]] = await database.query('SELECT id FROM cities WHERE region_id=? ORDER BY id LIMIT 1', [region.id]);
  const internalHash = await bcrypt.hash(`${region.region_code}-${Date.now()}-${Math.random()}`, 10);
  if (!city) {
    const [cityResult] = await database.query(
      `INSERT INTO cities(region_id,city_name,city_code,username,password_hash,created_by)
       VALUES(?,?,?,?,?,?)`,
      [region.id, 'Hiiraan Xarunta Degmooyinka', 'HSH-HIR-CTR', 'hsh_hir_district_catalog', internalHash, createdBy]
    );
    city = { id: cityResult.insertId };
  }

  let created = 0;
  for (const [districtName, districtCode] of HIIRAAN_DISTRICTS) {
    const [result] = await database.query(
      `INSERT IGNORE INTO districts(city_id,district_name,district_code,username,password_hash,created_by)
       VALUES(?,?,?,?,?,?)`,
      [city.id, districtName, districtCode, `catalog_${districtCode.toLowerCase().replaceAll('-', '_')}`, internalHash, createdBy]
    );
    created += result.affectedRows;
  }
  return created;
}

module.exports = { HIIRAAN_DISTRICTS, ensureHiiraanDistricts };
