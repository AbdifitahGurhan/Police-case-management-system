'use strict';
const db = require('../config/database');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res, next) => {
  try { 
    let query = `
      SELECT r.id, r.region_name, r.region_code, r.username, r.commander_officer_id, r.state_administration_id, s.state_name, p.full_name as commander_name
      FROM regions r
      JOIN state_administrations s ON r.state_administration_id = s.id
      LEFT JOIN police_officers p ON r.commander_officer_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (req.query.state_administration_id) {
      query += ` AND r.state_administration_id = ?`;
      params.push(req.query.state_administration_id);
    }

    if (req.user.scopeType === 'state_administration') {
      query += ` AND r.state_administration_id = ?`;
      params.push(req.user.scopeId);
    } else if (req.user.scopeType && req.user.scopeType !== 'admin') {
      // other centers can't fetch list of regions globally
      if (req.user.scopeType !== 'region') {
         // return res.status(403).json({success: false, message: 'Forbidden'});
      }
    }
    
    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const [rows] = await db.query(`
      SELECT r.*, p.full_name as commander_name, p.rank_id, rnk.rank_name as commander_rank, p.profile_image as commander_photo, s.state_name
      FROM regions r
      JOIN state_administrations s ON r.state_administration_id = s.id
      LEFT JOIN police_officers p ON r.commander_officer_id = p.id
      LEFT JOIN ranks rnk ON p.rank_id = rnk.id
      WHERE r.id = ?
    `, [id]);
    
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const region = rows[0];

    // Authorize
    if (req.user.scopeType === 'region' && req.user.scopeId !== region.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'state_administration' && req.user.scopeId !== region.state_administration_id) return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const [officerRows] = await db.query(`
      SELECT count(id) as count FROM officer_assignments WHERE assignment_type = 'Region' AND assignment_id = ? AND is_current = 1
    `, [id]);
    region.assigned_officer_count = officerRows[0].count;

    res.json({ success: true, data: region });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { state_administration_id, region_name, region_code, username, password, commander_officer_id } = req.body;
    
    // Auth check
    if (req.user.scopeType === 'state_administration' && req.user.scopeId !== parseInt(state_administration_id)) {
      return res.status(403).json({ success: false, message: 'You can only create regions under your own state.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const creator = req.user.username;

    const [result] = await db.query(`
      INSERT INTO regions (state_administration_id, region_name, region_code, username, password_hash, commander_officer_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [state_administration_id, region_name, region_code, username, hash, commander_officer_id || null, creator]);
    res.json({ success: true, message: 'Created successfully', id: result.insertId });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Username or Code already exists.'});
    next(err); 
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { state_administration_id, region_name, region_code, username, commander_officer_id } = req.body;

    const [rows] = await db.query('SELECT * FROM regions WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const region = rows[0];

    // Auth check
    if (req.user.scopeType === 'region' && req.user.scopeId !== parseInt(id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'state_administration' && req.user.scopeId !== region.state_administration_id) return res.status(403).json({ success: false, message: 'Forbidden' });

    await db.query(`
      UPDATE regions SET state_administration_id=?, region_name=?, region_code=?, username=?, commander_officer_id=?
      WHERE id=?
    `, [state_administration_id, region_name, region_code, username, commander_officer_id || null, id]);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM regions WHERE id=?', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
};
