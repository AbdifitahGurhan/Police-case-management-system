// src/controllers/stationController.js — Station CRUD
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const getStations = async (req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT s.*, w.name AS ward_name, d.name AS district_name, r.name AS region_name
      FROM stations s
      LEFT JOIN wards w ON s.ward_id = w.id
      LEFT JOIN districts d ON w.district_id = d.id
      LEFT JOIN regions r ON d.region_id = r.id
      ORDER BY s.name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getStationById = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM stations WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Station not found.' });
    const [staff] = await db.query(
      `SELECT u.id, u.full_name, u.email, u.rank, r.name AS role
       FROM users u JOIN roles r ON u.role_id = r.id
       WHERE u.station_id = ? AND u.is_active = 1`, [req.params.id]);
    res.json({ success: true, data: { ...rows[0], staff } });
  } catch (err) { next(err); }
};

const createStation = async (req, res, next) => {
  try {
    const { name, code, ward_id, address, phone, email } = req.body;
    if (!name || !code) return res.status(400).json({ success: false, message: 'name and code are required.' });
    const [result] = await db.query(
      `INSERT INTO stations (name, code, ward_id, address, phone, email) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, code, ward_id || null, address || null, phone || null, email || null]
    );
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'CREATE_STATION', entityType: 'stations', entityId: result.insertId, newData: req.body });
    res.status(201).json({ success: true, message: 'Station created.', stationId: result.insertId });
  } catch (err) { next(err); }
};

const updateStation = async (req, res, next) => {
  try {
    const { name, code, ward_id, address, phone, email, is_active } = req.body;
    await db.query(
      `UPDATE stations SET name=?, code=?, ward_id=?, address=?, phone=?, email=?, is_active=? WHERE id=?`,
      [name, code, ward_id, address, phone, email, is_active !== undefined ? is_active : 1, req.params.id]
    );
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'UPDATE_STATION', entityType: 'stations', entityId: parseInt(req.params.id), newData: req.body });
    res.json({ success: true, message: 'Station updated.' });
  } catch (err) { next(err); }
};

const deleteStation = async (req, res, next) => {
  try {
    await db.query('UPDATE stations SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Station deactivated.' });
  } catch (err) { next(err); }
};

const getGeography = async (req, res, next) => {
  try {
    const [regions] = await db.query('SELECT id, region_name AS name FROM regions ORDER BY region_name ASC');
    const [districts] = await db.query('SELECT id, district_name AS name FROM districts ORDER BY district_name ASC');
    const [wards] = await db.query('SELECT id, neighborhood_name AS name FROM neighborhoods ORDER BY neighborhood_name ASC');
    res.json({ success: true, data: { regions, districts, wards } });
  } catch (err) { next(err); }
};

module.exports = { getStations, getStationById, createStation, updateStation, deleteStation, getGeography };
