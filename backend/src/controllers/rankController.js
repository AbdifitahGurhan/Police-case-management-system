'use strict';
const db = require('../config/database');

exports.getAll = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM ranks ORDER BY rank_name');
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM ranks WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { rank_name, rank_code, description } = req.body;
    if (!rank_name || !rank_code) return res.status(400).json({ success: false, message: 'Missing required fields' });
    const creator = req.user.username; // Captures action author

    const [result] = await db.query(
      'INSERT INTO ranks (rank_name, rank_code, description, created_by) VALUES (?, ?, ?, ?)',
      [rank_name, rank_code, description || null, creator]
    );
    res.json({ success: true, message: 'Created successfully', id: result.insertId });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Rank name or code already exists.'});
    next(err); 
  }
};

exports.update = async (req, res, next) => {
  try {
    const { rank_name, rank_code, description } = req.body;
    if (!rank_name || !rank_code) return res.status(400).json({ success: false, message: 'Missing required fields' });

    await db.query(
      'UPDATE ranks SET rank_name=?, rank_code=?, description=? WHERE id=?',
      [rank_name, rank_code, description || null, req.params.id]
    );
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Rank name or code already exists.'});
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    await db.query('DELETE FROM ranks WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { 
    if(err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(400).json({success: false, message: 'Cannot delete rank because it is assigned to officers.'});
    next(err); 
  }
};
