'use strict';
const db = require('../config/database');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res, next) => {
  try { 
    let query = `
      SELECT c.id, c.district_name, c.district_code, c.username, c.commander_officer_id, c.city_id, p.full_name as commander_name
      FROM districts c
      LEFT JOIN police_officers p ON c.commander_officer_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (req.query.city_id) {
      query += ` AND d.city_id = ?`;
      params.push(req.query.city_id);
    }

    if (req.user.scopeType === 'city') {
      query += ` AND c.city_id = ?`;
      params.push(req.user.scopeId);
    } else if (req.user.scopeType) {
      if (req.user.role !== 'admin') return res.status(403).json({success: false, message: 'Forbidden'});
    }

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT c.*, p.full_name as commander_name, p.rank_id, rnk.rank_name as commander_rank, p.profile_image as commander_photo
      FROM districts c
      LEFT JOIN police_officers p ON c.commander_officer_id = p.id
      LEFT JOIN ranks rnk ON p.rank_id = rnk.id
      WHERE c.id = ?
    `, [id]);
    
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    // Authorize
    if (req.user.scopeType === 'district' && req.user.scopeId !== center.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'city' && req.user.scopeId !== center.city_id) return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const [officerRows] = await db.query(`
      SELECT count(id) as count FROM officer_assignments WHERE assignment_type = 'District' AND assignment_id = ? AND is_current = 1
    `, [id]);
    center.assigned_officer_count = officerRows[0].count;

    res.json({ success: true, data: center });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { city_id, district_name, district_code, username, password, commander_officer_id } = req.body;
    
    if (req.user.scopeType === 'city' && req.user.scopeId !== parseInt(city_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const hash = await bcrypt.hash(password, 10);
    const creator = req.user.username;

    const [result] = await db.query(`
      INSERT INTO districts (city_id, district_name, district_code, username, password_hash, commander_officer_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [city_id, district_name, district_code, username, hash, commander_officer_id || null, creator]);
    res.json({ success: true, message: 'Created successfully', id: result.insertId });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Username or Code already exists.'});
    next(err); 
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { city_id, district_name, district_code, username, commander_officer_id } = req.body;

    const [rows] = await db.query('SELECT * FROM districts WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    if (req.user.scopeType === 'district' && req.user.scopeId !== parseInt(id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'city' && req.user.scopeId !== center.city_id) return res.status(403).json({ success: false, message: 'Forbidden' });

    await db.query(`
      UPDATE districts SET city_id=?, district_name=?, district_code=?, username=?, commander_officer_id=?
      WHERE id=?
    `, [city_id, district_name, district_code, username, commander_officer_id || null, id]);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM districts WHERE id=?`, [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
};
