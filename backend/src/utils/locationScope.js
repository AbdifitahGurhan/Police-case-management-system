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

const CID_GLOBAL_READ_ROLES = new Set([
  'cid',
  'cid_director',
  'cid_supervisor',
  'cid_officer',
]);

const hasGlobalCidRead = (user) => CID_GLOBAL_READ_ROLES.has(normalizeRole(user?.role));

const buildScopeWhere = (user, alias = 'c') => {
  const params = [];
  let clause = '1=1';
  const role = normalizeRole(user?.role);
  if (!user || role === 'admin' || role === 'jail' || hasGlobalCidRead(user)) {
    return { clause, params };
  }

  const source = user.location || user;
  if (source.district_id || source.districtId || user.scopeType === 'district') {
    clause += ` AND ${alias}.district_id = ?`;
    params.push(source.district_id || source.districtId || user.scopeId);
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

  if (user.location) {
    return {
      state_administration_id: user.location.stateId || null,
      region_id: user.location.regionId || null,
      district_id: user.location.districtId || null,
      state_name: user.location.stateName || null,
      region_name: user.location.regionName || null,
      district_name: user.location.districtName || null,
    };
  }

  if (!user.scopeType) {
    const [[row]] = await db.query(
      `SELECT u.state_administration_id, COALESCE(u.region_id, d.region_id) AS region_id, u.district_id,
              sa.state_name, r.region_name, d.district_name
       FROM users u
       LEFT JOIN state_administrations sa ON u.state_administration_id = sa.id
       LEFT JOIN districts d ON u.district_id = d.id
       LEFT JOIN regions r ON COALESCE(u.region_id, d.region_id) = r.id
       WHERE u.id = ?`,
      [user.id]
    );
    if (row && (row.state_administration_id || row.region_id || row.district_id)) {
      return row;
    }
    const [[defaultDistrict]] = await db.query(
      `SELECT d.id AS district_id, d.district_name, r.id AS region_id, r.region_name, sa.id AS state_administration_id, sa.state_name
       FROM districts d
       LEFT JOIN regions r ON d.region_id = r.id
       LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id
       ORDER BY d.id ASC LIMIT 1`
    );
    return defaultDistrict || row || {};
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

  if (user.scopeType === 'district') {
    const [[row]] = await db.query(
      `SELECT sa.id AS state_administration_id, r.id AS region_id, d.id AS district_id,
              sa.state_name, r.region_name, d.district_name
       FROM districts d
       LEFT JOIN regions r ON d.region_id = r.id
       LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id
       WHERE d.id = ?`,
      [user.scopeId]
    );
    return row || {};
  }

  return {};
};

module.exports = { buildScopeWhere, getUserLocation, normalizeRole, hasGlobalCidRead };
