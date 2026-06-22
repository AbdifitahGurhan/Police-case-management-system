'use strict';

const db = require('../config/database');
const { normalizeRole } = require('../utils/locationScope');

const hierarchyFilter = (user) => {
  if (!user || normalizeRole(user.role) === 'admin') return { where: '', params: [] };
  const location = user.location || {};
  if (location.districtId || user.scopeType === 'district') return { where: 'WHERE d.id = ?', params: [location.districtId || user.scopeId] };
  if (location.regionId || user.scopeType === 'region') return { where: 'WHERE r.id = ?', params: [location.regionId || user.scopeId] };
  if (location.stateId || user.scopeType === 'state_administration') return { where: 'WHERE sa.id = ?', params: [location.stateId || user.scopeId] };
  return { where: '', params: [] };
};

const getHierarchy = async (req, res, next) => {
  try {
    const filter = hierarchyFilter(req.user);
    const [rows] = await db.query(
      `SELECT
         sa.id AS state_id, sa.state_name, sa.state_code, sa.username AS state_username,
         sc.full_name AS state_commander_name, sc.phone AS state_commander_phone,
         r.id AS region_id, r.region_name, r.region_code, r.username AS region_username,
         rc.full_name AS region_commander_name, rc.phone AS region_commander_phone,
         d.id AS district_id, d.district_name, d.district_code, d.username AS district_username,
         dc.full_name AS district_commander_name, dc.phone AS district_commander_phone
       FROM state_administrations sa
       LEFT JOIN police_officers sc ON sa.commander_officer_id = sc.id
       LEFT JOIN regions r ON r.state_administration_id = sa.id
       LEFT JOIN police_officers rc ON r.commander_officer_id = rc.id
       LEFT JOIN cities c ON c.region_id = r.id
       LEFT JOIN districts d ON d.city_id = c.id
       LEFT JOIN police_officers dc ON d.commander_officer_id = dc.id
       ${filter.where}
       ORDER BY sa.state_name, r.region_name, d.district_name`
      ,
      filter.params
    );

    const states = new Map();
    rows.forEach((row) => {
      if (!row.state_id) return;
      if (!states.has(row.state_id)) {
        states.set(row.state_id, {
          id: row.state_id,
          name: row.state_name,
          code: row.state_code,
          username: row.state_username,
          commanderName: row.state_commander_name,
          commanderPhone: row.state_commander_phone,
          regions: [],
        });
      }
      const state = states.get(row.state_id);
      let region = state.regions.find((item) => item.id === row.region_id);
      if (row.region_id && !region) {
        region = {
          id: row.region_id,
          name: row.region_name,
          code: row.region_code,
          username: row.region_username,
          commanderName: row.region_commander_name,
          commanderPhone: row.region_commander_phone,
          districts: [],
        };
        state.regions.push(region);
      }
      let district = region?.districts.find((item) => item.id === row.district_id);
      if (region && row.district_id && !district) {
        district = {
          id: row.district_id,
          name: row.district_name,
          code: row.district_code,
          username: row.district_username,
          commanderName: row.district_commander_name,
          commanderPhone: row.district_commander_phone,
        };
        region.districts.push(district);
      }
    });

    const [[summary]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM state_administrations) AS states,
         (SELECT COUNT(*) FROM regions) AS regions,
         (SELECT COUNT(*) FROM districts) AS district_police_stations,
         (SELECT COUNT(*) FROM users WHERE user_type = 'OB_STAFF' AND is_active = 1) AS ob_staff,
         (SELECT COUNT(*) FROM users WHERE user_type = 'STAFF' AND is_active = 1) AS staff,
         (SELECT COUNT(*) FROM cases WHERE status NOT IN ('closed','CLOSED')) AS active_cases`
    );

    res.json({ success: true, data: { summary, hierarchy: Array.from(states.values()) } });
  } catch (err) { next(err); }
};

const getLocationProfiles = async (req, res, next) => {
  try {
    const filter = hierarchyFilter(req.user);
    const locationWhere = (levelAlias) => {
      if (!filter.params.length) return '';
      if (filter.where.includes('d.id')) return levelAlias === 'd' ? 'WHERE d.id = ?' : 'WHERE 1=0';
      if (filter.where.includes('r.id')) return ['r', 'd'].includes(levelAlias) ? 'WHERE r.id = ?' : 'WHERE 1=0';
      if (filter.where.includes('sa.id')) return 'WHERE sa.id = ?';
      return '';
    };
    const params = [
      ...(locationWhere('sa') ? filter.params : []),
      ...(locationWhere('r') ? filter.params : []),
      ...(locationWhere('d') ? filter.params : []),
    ];
    const [rows] = await db.query(
      `SELECT 'STATE' AS level, sa.id, sa.state_name AS location_name, sa.state_code AS location_code,
              'Administration' AS parent_location, p.full_name AS commander_name, p.phone AS commander_phone,
              (SELECT COUNT(*) FROM users u WHERE u.state_administration_id = sa.id AND u.user_type = 'OB_STAFF') AS total_ob_staff,
              (SELECT COUNT(*) FROM users u WHERE u.state_administration_id = sa.id AND u.user_type = 'STAFF') AS total_staff,
              (SELECT COUNT(*) FROM cases c WHERE c.state_administration_id = sa.id AND c.status NOT IN ('closed','CLOSED')) AS total_active_cases,
              'ACTIVE' AS status
       FROM state_administrations sa
       LEFT JOIN police_officers p ON sa.commander_officer_id = p.id
       ${locationWhere('sa')}
       UNION ALL
       SELECT 'REGION', r.id, r.region_name, r.region_code, sa.state_name, p.full_name, p.phone,
              (SELECT COUNT(*) FROM users u WHERE u.region_id = r.id AND u.user_type = 'OB_STAFF'),
              (SELECT COUNT(*) FROM users u WHERE u.region_id = r.id AND u.user_type = 'STAFF'),
              (SELECT COUNT(*) FROM cases c WHERE c.region_id = r.id AND c.status NOT IN ('closed','CLOSED')),
              'ACTIVE'
       FROM regions r
       LEFT JOIN state_administrations sa ON r.state_administration_id = sa.id
       LEFT JOIN police_officers p ON r.commander_officer_id = p.id
       ${locationWhere('r')}
       UNION ALL
       SELECT 'DISTRICT_POLICE_STATION', d.id, d.district_name, d.district_code, r.region_name, p.full_name, p.phone,
              (SELECT COUNT(*) FROM users u WHERE u.district_id = d.id AND u.user_type = 'OB_STAFF'),
              (SELECT COUNT(*) FROM users u WHERE u.district_id = d.id AND u.user_type = 'STAFF'),
              (SELECT COUNT(*) FROM cases c WHERE c.district_id = d.id AND c.status NOT IN ('closed','CLOSED')),
              'ACTIVE'
       FROM districts d
       LEFT JOIN cities ci ON d.city_id = ci.id
       LEFT JOIN regions r ON ci.region_id = r.id
       LEFT JOIN police_officers p ON d.commander_officer_id = p.id
       ${locationWhere('d')}`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { getHierarchy, getLocationProfiles };
