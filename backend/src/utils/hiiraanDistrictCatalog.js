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
  const internalHash = await bcrypt.hash(`${region.region_code}-${Date.now()}-${Math.random()}`, 10);

  let created = 0;
  for (const [districtName, districtCode] of HIIRAAN_DISTRICTS) {
    const [result] = await database.query(
      `INSERT IGNORE INTO districts(region_id,district_name,district_code,username,password_hash,created_by)
       VALUES(?,?,?,?,?,?)`,
      [region.id, districtName, districtCode, `catalog_${districtCode.toLowerCase().replaceAll('-', '_')}`, internalHash, createdBy]
    );
    created += result.affectedRows;
  }
  return created;
}

module.exports = { HIIRAAN_DISTRICTS, ensureHiiraanDistricts };
