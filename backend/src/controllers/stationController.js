// src/controllers/stationController.js - District station CRUD
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const getStations = async (req, res, next) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.user.scopeType === 'region') {
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
      WHERE ${where}
      ORDER BY d.district_name ASC
    `, params);
    res.json({ success: true, data: rows });
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
    if (req.user.scopeType === 'region') {
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
       WHERE oa.assignment_type = 'District'
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
         (SELECT COUNT(*) FROM officer_assignments WHERE assignment_type = 'District' AND assignment_id = ? AND is_current = 1) AS officer_count`,
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
    const params = [];
    let regionWhere = '1=1';
    let cityWhere = '1=1';
    let districtWhere = '1=1';
    let wardWhere = '1=1';

    if (req.user.scopeType === 'region') {
      regionWhere = 'id = ?';
      cityWhere = 'region_id = ?';
      districtWhere = 'city_id IN (SELECT id FROM cities WHERE region_id = ?)';
      wardWhere = 'district_id IN (SELECT d.id FROM districts d JOIN cities c ON d.city_id = c.id WHERE c.region_id = ?)';
      params.push(req.user.scopeId);
    }

    const [regions] = await db.query(`SELECT id, region_name AS name FROM regions WHERE ${regionWhere} ORDER BY region_name ASC`, params);
    const [cities] = await db.query(`SELECT id, city_name AS name, region_id FROM cities WHERE ${cityWhere} ORDER BY city_name ASC`, params);
    const [districts] = await db.query(`SELECT id, district_name AS name, city_id FROM districts WHERE ${districtWhere} ORDER BY district_name ASC`, params);
    res.json({ success: true, data: { regions, cities, districts } });
  } catch (err) { next(err); }
};

module.exports = { getStations, getStationById, createStation, updateStation, deleteStation, getGeography };
