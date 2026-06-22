'use strict';

const db = require('../config/database');

const ROLE_ALIASES = {
  STATE_COMMANDER: 'state_commander',
  REGION_COMMANDER: 'region_commander',
  DISTRICT_COMMANDER: 'district_commander',
  POLICE_STATION_COMMANDER: 'police_station_commander',
  OB_STAFF: 'ob_staff',
  STAFF: 'staff',
};

const normalizeRole = (role) => ROLE_ALIASES[role] || String(role || '').toLowerCase();

const buildScopeWhere = (user, alias = 'c') => {
  const params = [];
  let clause = '1=1';
  if (!user || normalizeRole(user.role) === 'admin') return { clause, params };

  const source = user.location || user;
  if (source.district_id || source.districtId || user.scopeType === 'district') {
    clause += ` AND ${alias}.district_id = ?`;
    params.push(source.district_id || source.districtId || user.scopeId);
  } else if (source.city_id || source.cityId || user.scopeType === 'city') {
    clause += ` AND ${alias}.city_id = ?`;
    params.push(source.city_id || source.cityId || user.scopeId);
  } else if (source.region_id || source.regionId || user.scopeType === 'region') {
    clause += ` AND ${alias}.region_id = ?`;
    params.push(source.region_id || source.regionId || user.scopeId);
  } else if (source.state_administration_id || source.stateId || user.scopeType === 'state_administration') {
    clause += ` AND ${alias}.state_administration_id = ?`;
    params.push(source.state_administration_id || source.stateId || user.scopeId);
  }
  return { clause, params };
};

const getUserLocation = async (user) => {
  if (!user) return {};

  const needsCityLookup = ['city', 'district'].includes(user.scopeType) && !user.location?.cityId;
  if (user.location && !needsCityLookup) {
    return {
      state_administration_id: user.location.stateId || null,
      region_id: user.location.regionId || null,
      city_id: user.location.cityId || null,
      district_id: user.location.districtId || null,
      state_name: user.location.stateName || null,
      region_name: user.location.regionName || null,
      city_name: user.location.cityName || null,
      district_name: user.location.districtName || null,
    };
  }

  if (!user.scopeType) {
    const [[row]] = await db.query(
      `SELECT u.state_administration_id, u.region_id, ci.id AS city_id, u.district_id,
              sa.state_name, r.region_name, ci.city_name, d.district_name
       FROM users u
       LEFT JOIN state_administrations sa ON u.state_administration_id = sa.id
       LEFT JOIN regions r ON u.region_id = r.id
       LEFT JOIN districts d ON u.district_id = d.id
       LEFT JOIN cities ci ON d.city_id = ci.id
       WHERE u.id = ?`,
      [user.id]
    );
    return row || {};
  }

  if (user.scopeType === 'state_administration') {
    const [[row]] = await db.query(
      `SELECT id AS state_administration_id, state_name FROM state_administrations WHERE id = ?`,
      [user.scopeId]
    );
    return row || {};
  }

  if (user.scopeType === 'region') {
    const [[row]] = await db.query(
      `SELECT r.state_administration_id, r.id AS region_id, sa.state_name, r.region_name
       FROM regions r
       LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id
       WHERE r.id = ?`,
      [user.scopeId]
    );
    return row || {};
  }

  if (user.scopeType === 'city') {
    const [[row]] = await db.query(
      `SELECT sa.id AS state_administration_id, r.id AS region_id, c.id AS city_id,
              sa.state_name, r.region_name, c.city_name
       FROM cities c
       LEFT JOIN regions r ON c.region_id = r.id
       LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id
       WHERE c.id = ?`,
      [user.scopeId]
    );
    return row || {};
  }

  if (user.scopeType === 'district') {
    const [[row]] = await db.query(
      `SELECT sa.id AS state_administration_id, r.id AS region_id, c.id AS city_id, d.id AS district_id,
              sa.state_name, r.region_name, c.city_name, d.district_name
       FROM districts d
       LEFT JOIN cities c ON d.city_id = c.id
       LEFT JOIN regions r ON c.region_id = r.id
       LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id
       WHERE d.id = ?`,
      [user.scopeId]
    );
    return row || {};
  }

  return {};
};

module.exports = { buildScopeWhere, getUserLocation, normalizeRole };
