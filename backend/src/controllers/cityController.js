'use strict';
const db = require('../config/database');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res, next) => {
  try { 
    let query = `
      SELECT c.id, c.city_name, c.city_code, c.username, c.commander_officer_id, c.region_id, p.full_name as commander_name
      FROM cities c
      LEFT JOIN police_officers p ON c.commander_officer_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (req.query.region_id) {
      query += ` AND c.region_id = ?`;
      params.push(req.query.region_id);
    }

    if (req.user.scopeType === 'region') {
      query += ` AND c.region_id = ?`;
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
      FROM cities c
      LEFT JOIN police_officers p ON c.commander_officer_id = p.id
      LEFT JOIN ranks rnk ON p.rank_id = rnk.id
      WHERE c.id = ?
    `, [id]);
    
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    // Authorize
    if (req.user.scopeType === 'city' && req.user.scopeId !== center.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'region' && req.user.scopeId !== center.region_id) return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const [officerRows] = await db.query(`
      SELECT count(id) as count FROM officer_assignments WHERE assignment_type = 'City' AND assignment_id = ? AND is_current = 1
    `, [id]);
    center.assigned_officer_count = officerRows[0].count;

    res.json({ success: true, data: center });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { region_id, city_name, city_code, username, password, commander_officer_id } = req.body;
    
    if (req.user.scopeType === 'region' && req.user.scopeId !== parseInt(region_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const hash = await bcrypt.hash(password, 10);
    const creator = req.user.username;

    const [result] = await db.query(`
      INSERT INTO cities (region_id, city_name, city_code, username, password_hash, commander_officer_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [region_id, city_name, city_code, username, hash, commander_officer_id || null, creator]);
    res.json({ success: true, message: 'Created successfully', id: result.insertId });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Username or Code already exists.'});
    next(err); 
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { region_id, city_name, city_code, username, commander_officer_id } = req.body;

    const [rows] = await db.query('SELECT * FROM cities WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    if (req.user.scopeType === 'city' && req.user.scopeId !== parseInt(id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'region' && req.user.scopeId !== center.region_id) return res.status(403).json({ success: false, message: 'Forbidden' });

    await db.query(`
      UPDATE cities SET region_id=?, city_name=?, city_code=?, username=?, commander_officer_id=?
      WHERE id=?
    `, [region_id, city_name, city_code, username, commander_officer_id || null, id]);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query(`DELETE FROM cities WHERE id=?`, [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
};
