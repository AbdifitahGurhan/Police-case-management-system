'use strict';
const db = require('../config/database');
const bcrypt = require('bcryptjs');

exports.getAll = async (req, res, next) => {
  try { // Only admin should see all state admins
    const [rows] = await db.query(`
      SELECT s.id, s.state_name, s.state_code, s.username, s.commander_officer_id, s.created_at, p.full_name as commander_name
      FROM state_administrations s
      LEFT JOIN police_officers p ON s.commander_officer_id = p.id
      ORDER BY s.state_name
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Enforcement: if user is state_admin, can only see their own
    if (req.user.scopeType === 'state_administration' && req.user.scopeId !== parseInt(id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const [rows] = await db.query(`
      SELECT s.id, s.state_name, s.state_code, s.username, s.commander_officer_id, s.created_at,
             p.full_name as commander_name, p.rank_id, r.rank_name as commander_rank, p.profile_image as commander_photo
      FROM state_administrations s
      LEFT JOIN police_officers p ON s.commander_officer_id = p.id
      LEFT JOIN ranks r ON p.rank_id = r.id
      WHERE s.id = ?
    `, [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    // also fetch assigned officer count (sum of all officers in all units under this? or specifically assigned to this unit?)
    // Requirements: "assigned officer count". For now, just officers assigned to this specific state_administration
    const [officerRows] = await db.query(`
      SELECT count(id) as count FROM officer_assignments WHERE assignment_type = 'State Administration' AND assignment_id = ? AND is_current = 1
    `, [id]);
    rows[0].assigned_officer_count = officerRows[0].count;

    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { state_name, state_code, username, password, commander_officer_id } = req.body;
    if (!state_name || !state_code || !username || !password) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }
    const hash = await bcrypt.hash(password, 10);
    const creator = req.user.username; // track creator as string

    const [result] = await db.query(`
      INSERT INTO state_administrations (state_name, state_code, username, password_hash, commander_officer_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [state_name, state_code, username, hash, commander_officer_id || null, creator]);
    res.json({ success: true, message: 'Created successfully', id: result.insertId });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Username or Code already exists.'});
    next(err); 
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
     if (req.user.scopeType === 'state_administration' && req.user.scopeId !== parseInt(id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    const { state_name, state_code, username, commander_officer_id } = req.body;
    await db.query(`
      UPDATE state_administrations SET state_name=?, state_code=?, username=?, commander_officer_id=?
      WHERE id=?
    `, [state_name, state_code, username, commander_officer_id || null, id]);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM state_administrations WHERE id=?', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
};
