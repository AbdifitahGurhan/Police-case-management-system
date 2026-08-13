// src/controllers/stationController.js - District station CRUD
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const ensureStationInScope = async (req, stationId) => {
  const [rows] = await db.query(
    `SELECT d.id,
            d.district_name AS name,
            d.district_code AS code,
            d.city_id,
            c.city_name,
            r.id AS region_id,
            r.state_administration_id,
            r.region_name,
            d.username,
            d.commander_officer_id,
            p.full_name AS commander_name,
            d.created_at,
            d.updated_at,
            1 AS is_active
       FROM districts d
       LEFT JOIN cities c ON d.city_id = c.id
       LEFT JOIN regions r ON c.region_id = r.id
       LEFT JOIN police_officers p ON d.commander_officer_id = p.id
      WHERE d.id = ?`,
    [stationId]
  );
  if (!rows.length) return { status: 404, message: 'Station not found.' };
  const station = rows[0];
  if (req.user.scopeType === 'state_administration' && Number(station.state_administration_id) !== Number(req.user.scopeId)) {
    return { status: 403, message: 'Forbidden' };
  }
  if (req.user.scopeType === 'region' && Number(station.region_id) !== Number(req.user.scopeId)) {
    return { status: 403, message: 'Forbidden' };
  }
  if (req.user.scopeType === 'district' && Number(req.user.scopeId) !== Number(station.id)) {
    return { status: 403, message: 'Forbidden' };
  }
  if (req.user.scopeType && req.user.role !== 'admin' && !['state_administration', 'region', 'district'].includes(req.user.scopeType)) {
    return { status: 403, message: 'Forbidden' };
  }
  return { station };
};

const getStations = async (req, res, next) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.user.scopeType === 'state_administration') {
      where += ' AND r.state_administration_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'region') {
      where += ' AND r.id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'district') {
      where += ' AND d.id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType && req.user.role !== 'admin') {
      where += ' AND 1=0';
    }

    const [rows] = await db.query(`
      SELECT d.id,
             d.district_name AS name,
             d.district_code AS code,
             d.city_id,
             c.city_name,
             r.state_administration_id,
             r.region_name,
             d.username,
             d.commander_officer_id,
             p.full_name AS commander_name,
             d.created_at,
             d.updated_at,
             1 AS is_active,
             (SELECT COUNT(DISTINCT oa.officer_id)
                FROM officer_assignments oa
               WHERE oa.assignment_type IN ('District', 'District Station')
                 AND oa.assignment_id = d.id
                 AND oa.is_current = 1) AS officers_count,
             (SELECT COUNT(DISTINCT u.id)
                FROM users u
                JOIN roles ur ON ur.id = u.role_id
               WHERE u.district_id = d.id
                 AND LOWER(ur.name) = 'ob_staff'
                 AND u.is_active = 1
                 AND COALESCE(u.status, 'ACTIVE') = 'ACTIVE') AS ob_staff_count,
             (SELECT COUNT(DISTINCT c_inv.id)
                FROM cases c_inv
                JOIN users iu ON iu.police_officer_id = c_inv.assigned_officer_id
                JOIN roles ir ON ir.id = iu.role_id
               WHERE c_inv.district_id = d.id
                 AND LOWER(ir.name) = 'investigator'
                 AND iu.is_active = 1
                 AND COALESCE(iu.status, 'ACTIVE') = 'ACTIVE'
                 AND c_inv.status NOT IN ('closed','CLOSED','dismissed','rejected','archived','REJECTED')) AS investigation_cases,
             (SELECT COUNT(DISTINCT pa.id)
                FROM prison_admissions pa
                JOIN arrests a ON a.id = pa.arrest_id
                JOIN cases c_pa ON c_pa.id = a.case_id
               WHERE c_pa.district_id = d.id
                 AND pa.status = 'admitted') AS station_prisoners,
             (SELECT COUNT(*)
                FROM cases c_open
               WHERE c_open.district_id = d.id
                 AND c_open.status NOT IN ('draft','pending','pending_commander_review','PENDING_COMMANDER_REVIEW','CASE_REGISTERED','referred_to_court','court_decided','sentenced','judgment_issued','closed','CLOSED','dismissed','rejected','archived','REJECTED')) AS furan_cases,
             (SELECT COUNT(*)
                FROM cases c_pending
               WHERE c_pending.district_id = d.id
                 AND c_pending.status IN ('draft','pending','pending_commander_review','PENDING_COMMANDER_REVIEW','CASE_REGISTERED')) AS sugaya_cases,
             (SELECT COUNT(*)
                FROM cases c_closing
               WHERE c_closing.district_id = d.id
                 AND c_closing.status IN ('referred_to_court','court_decided','sentenced','judgment_issued')) AS xidhitaan_cases,
             (SELECT COUNT(*)
                FROM cases c_closed
               WHERE c_closed.district_id = d.id
                 AND c_closed.status IN ('closed','CLOSED','dismissed','rejected','archived','REJECTED')) AS xiray_cases
      FROM districts d
      LEFT JOIN cities c ON d.city_id = c.id
      LEFT JOIN regions r ON c.region_id = r.id
      LEFT JOIN police_officers p ON d.commander_officer_id = p.id
      WHERE ${where}
      ORDER BY d.district_name ASC
    `, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getStationOverview = async (req, res, next) => {
  try {
    const stationId = Number(req.params.id);
    const scoped = await ensureStationInScope(req, stationId);
    if (!scoped.station) {
      return res.status(scoped.status).json({ success: false, message: scoped.message });
    }

    const [obStaff] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.rank, u.user_type,
              u.assigned_level, u.is_active, u.status, u.last_login, u.created_at,
              r.name AS role,
              po.force_number, po.full_name AS officer_name, rk.rank_name AS officer_rank
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN police_officers po ON po.id = u.police_officer_id
         LEFT JOIN ranks rk ON rk.id = po.rank_id
        WHERE u.district_id = ?
          AND LOWER(r.name) = 'ob_staff'
          AND u.is_active = 1
          AND COALESCE(u.status, 'ACTIVE') = 'ACTIVE'
        ORDER BY u.full_name ASC, u.username ASC`,
      [stationId]
    );

    const obStaffIds = obStaff.map((item) => item.id);
    let obEntries = [];
    if (obStaffIds.length) {
      obEntries = (await db.query(
        `SELECT ob.id, ob.ob_number, ob.case_title, ob.case_type, ob.status,
                ob.reported_by, ob.reporter_phone, ob.incident_location,
                ob.incident_datetime, ob.registration_date, ob.created_at,
                ob.registered_by_user_id,
                c.id AS linked_case_id, c.case_number AS linked_case_number, c.status AS linked_case_status
           FROM ob_entries ob
           LEFT JOIN cases c ON c.ob_entry_id = ob.id OR c.ob_number = ob.ob_number
          WHERE ob.district_id = ?
            AND ob.deleted_at IS NULL
            AND ob.registered_by_user_id IN (${obStaffIds.map(() => '?').join(',')})
          ORDER BY ob.created_at DESC`,
        [stationId, ...obStaffIds]
      ))[0];
    }
    const obEntriesByUser = obEntries.reduce((acc, item) => {
      const key = Number(item.registered_by_user_id);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
    const obStaffWithEntries = obStaff.map((item) => ({
      ...item,
      ob_entries: obEntriesByUser[Number(item.id)] || [],
    }));

    const [investigators] = await db.query(
      `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.rank, u.user_type,
              u.assigned_level, u.is_active, u.status, u.last_login, u.created_at,
              u.police_officer_id,
              r.name AS role,
              po.force_number, po.full_name AS officer_name, rk.rank_name AS officer_rank
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN police_officers po ON po.id = u.police_officer_id
         LEFT JOIN ranks rk ON rk.id = po.rank_id
        WHERE u.district_id = ?
          AND LOWER(r.name) = 'investigator'
          AND u.is_active = 1
          AND COALESCE(u.status, 'ACTIVE') = 'ACTIVE'
        ORDER BY u.full_name ASC, u.username ASC`,
      [stationId]
    );

    const [investigationCases] = await db.query(
      `SELECT iu.id AS investigator_user_id,
              c.id, c.case_number, c.ob_number, COALESCE(c.title, c.case_title) AS title,
              c.incident_type, c.case_type, c.priority, c.status, c.created_at,
              c.incident_date, c.incident_location, c.assigned_officer_id,
              po.full_name AS assigned_investigator,
              po.force_number AS investigator_force_number,
              rk.rank_name AS investigator_rank
         FROM cases c
         JOIN users iu ON iu.police_officer_id = c.assigned_officer_id
         JOIN roles ir ON ir.id = iu.role_id
         LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
         LEFT JOIN ranks rk ON rk.id = po.rank_id
        WHERE c.district_id = ?
          AND LOWER(ir.name) = 'investigator'
          AND iu.is_active = 1
          AND COALESCE(iu.status, 'ACTIVE') = 'ACTIVE'
          AND c.status NOT IN ('closed','CLOSED','dismissed','rejected','archived','REJECTED')
        ORDER BY c.created_at DESC`,
      [stationId]
    );
    const casesByInvestigator = investigationCases.reduce((acc, item) => {
      const key = Number(item.investigator_user_id);
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
    const investigatorsWithCases = investigators.map((item) => ({
      ...item,
      assigned_cases: casesByInvestigator[Number(item.id)] || [],
    }));

    const [stationPrisoners] = await db.query(
      `SELECT pa.id, pa.prison_number, pa.facility, pa.admission_date, pa.status,
              pa.admitted_by, pa.notes, pa.confirmed_at,
              s.id AS suspect_id, s.full_name, s.gender, s.date_of_birth,
              a.id AS arrest_id, a.case_id, a.arrest_date, a.arrest_location,
              a.charges, a.sentence_status, a.expected_release_date,
              c.case_number, c.ob_number,
              pca.block_name, pca.cell_number,
              pc.capacity AS cell_capacity,
              (SELECT COUNT(*) FROM prison_cell_assignments x
                WHERE x.facility = pca.facility
                  AND x.block_name = pca.block_name
                  AND x.cell_number = pca.cell_number
                  AND x.released_at IS NULL) AS cell_occupancy,
              (SELECT pt.status FROM prison_transfers pt WHERE pt.arrest_id = a.id ORDER BY pt.created_at DESC LIMIT 1) AS latest_transfer_status,
              (SELECT pt.to_facility FROM prison_transfers pt WHERE pt.arrest_id = a.id ORDER BY pt.created_at DESC LIMIT 1) AS latest_transfer_to_facility
         FROM prison_admissions pa
         JOIN criminals s ON s.id = pa.suspect_id
         JOIN arrests a ON a.id = pa.arrest_id
         JOIN cases c ON c.id = a.case_id
         LEFT JOIN prison_cell_assignments pca ON pca.admission_id = pa.id AND pca.released_at IS NULL
         LEFT JOIN prison_cells pc ON pc.facility = pca.facility AND pc.block_name = pca.block_name AND pc.cell_number = pca.cell_number
        WHERE c.district_id = ?
          AND pa.status = 'admitted'
        ORDER BY pa.admission_date DESC`,
      [stationId]
    );

    res.json({
      success: true,
      data: {
        station: scoped.station,
        ob_staff: obStaffWithEntries,
        investigators: investigatorsWithCases,
        investigation_cases: investigationCases,
        station_prisoners: stationPrisoners,
      },
    });
  } catch (err) { next(err); }
};

const getStationById = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT d.id,
              d.district_name AS name,
              d.district_code AS code,
              d.city_id,
              c.city_name,
              r.state_administration_id,
              r.id AS region_id,
              r.region_name,
              d.username,
              d.commander_officer_id,
              p.full_name AS commander_name,
              d.created_at,
              d.updated_at,
              1 AS is_active
       FROM districts d
       LEFT JOIN cities c ON d.city_id = c.id
       LEFT JOIN regions r ON c.region_id = r.id
       LEFT JOIN police_officers p ON d.commander_officer_id = p.id
       WHERE d.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Station not found.' });
    if (req.user.scopeType === 'state_administration') {
      if (Number(rows[0].state_administration_id) !== Number(req.user.scopeId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    } else if (req.user.scopeType === 'region') {
      const [[allowed]] = await db.query(
        `SELECT d.id
         FROM districts d
         JOIN cities c ON d.city_id = c.id
         WHERE d.id = ? AND c.region_id = ?`,
        [req.params.id, req.user.scopeId]
      );
      if (!allowed) return res.status(403).json({ success: false, message: 'Forbidden' });
    } else if (req.user.scopeType === 'district' && Number(req.user.scopeId) !== Number(rows[0].id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    } else if (req.user.scopeType && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const [staff] = await db.query(
      `SELECT po.id, po.full_name, po.email, rk.rank_name AS rank, 'officer' AS role
       FROM officer_assignments oa
       JOIN police_officers po ON oa.officer_id = po.id
       LEFT JOIN ranks rk ON po.rank_id = rk.id
       WHERE oa.assignment_type IN ('District', 'District Station')
         AND oa.assignment_id = ?
         AND oa.is_current = 1`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...rows[0], staff } });
  } catch (err) { next(err); }
};

const createStation = async (req, res, next) => {
  try {
    const { name, code, city_id, username, password, commander_officer_id } = req.body;
    if (!name || !code || !city_id) {
      return res.status(400).json({ success: false, message: 'name, code, and city_id are required.' });
    }
    if (!password) {
      return res.status(400).json({ success: false, message: 'password is required for station login.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO districts (city_id, district_name, district_code, username, password_hash, commander_officer_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [city_id, name, code, username || code.toLowerCase(), passwordHash, commander_officer_id || null, req.user.username || req.user.id]
    );

    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'CREATE_STATION',
      entityType: 'stations',
      entityId: result.insertId,
      newData: { name, code, city_id, username, commander_officer_id },
    });
    res.status(201).json({ success: true, message: 'Station created.', stationId: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Station username or code already exists.' });
    }
    next(err);
  }
};

const updateStation = async (req, res, next) => {
  try {
    const { name, code, city_id, username, commander_officer_id } = req.body;
    await db.query(
      `UPDATE districts
       SET district_name = COALESCE(?, district_name),
           district_code = COALESCE(?, district_code),
           city_id = COALESCE(?, city_id),
           username = COALESCE(?, username),
           commander_officer_id = ?
       WHERE id = ?`,
      [name || null, code || null, city_id || null, username || null, commander_officer_id || null, req.params.id]
    );
    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_STATION',
      entityType: 'stations',
      entityId: parseInt(req.params.id, 10),
      newData: req.body,
    });
    res.json({ success: true, message: 'Station updated.' });
  } catch (err) { next(err); }
};

const deleteStation = async (req, res, next) => {
  try {
    const stationId = req.params.id;
    const [[dependencies]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM cases WHERE district_id = ?) AS cases_count,
         (SELECT COUNT(*) FROM officer_assignments WHERE assignment_type IN ('District', 'District Station') AND assignment_id = ? AND is_current = 1) AS officer_count`,
      [stationId, stationId]
    );

    if (dependencies.cases_count || dependencies.officer_count) {
      return res.status(409).json({
        success: false,
        message: 'Station cannot be deleted while it has cases or assigned officers.',
        dependencies,
      });
    }

    const [result] = await db.query('DELETE FROM districts WHERE id = ?', [stationId]);
    if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Station not found.' });

    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'DELETE_STATION',
      entityType: 'stations',
      entityId: parseInt(stationId, 10),
    });
    res.json({ success: true, message: 'Station deleted.' });
  } catch (err) { next(err); }
};

const getGeography = async (req, res, next) => {
  try {
    let regionWhere = '1=1';
    let regionParams = [];
    let cityWhere = '1=1';
    let cityParams = [];
    let districtWhere = '1=1';
    let districtParams = [];

    if (req.user.scopeType === 'state_administration') {
      regionWhere = 'state_administration_id = ?';
      regionParams = [req.user.scopeId];
      cityWhere = 'region_id IN (SELECT id FROM regions WHERE state_administration_id = ?)';
      cityParams = [req.user.scopeId];
      districtWhere = 'city_id IN (SELECT c.id FROM cities c JOIN regions r ON r.id = c.region_id WHERE r.state_administration_id = ?)';
      districtParams = [req.user.scopeId];
    } else if (req.user.scopeType === 'region') {
      regionWhere = 'id = ?';
      regionParams = [req.user.scopeId];
      cityWhere = 'region_id = ?';
      cityParams = [req.user.scopeId];
      districtWhere = 'city_id IN (SELECT id FROM cities WHERE region_id = ?)';
      districtParams = [req.user.scopeId];
    } else if (req.user.scopeType === 'district') {
      districtWhere = 'id = ?';
      districtParams = [req.user.scopeId];
    }

    const [regions] = await db.query(`SELECT id, region_name AS name FROM regions WHERE ${regionWhere} ORDER BY region_name ASC`, regionParams);
    const [cities] = await db.query(`SELECT id, city_name AS name, region_id FROM cities WHERE ${cityWhere} ORDER BY city_name ASC`, cityParams);
    const [districts] = await db.query(`SELECT id, district_name AS name, city_id FROM districts WHERE ${districtWhere} ORDER BY district_name ASC`, districtParams);
    res.json({ success: true, data: { regions, cities, districts } });
  } catch (err) { next(err); }
};

module.exports = { getStations, getStationOverview, getStationById, createStation, updateStation, deleteStation, getGeography };
