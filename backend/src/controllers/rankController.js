'use strict';
const db = require('../config/database');

exports.getAll = async (req, res, next) => {
  try {
    let [rows] = await db.query('SELECT * FROM ranks ORDER BY id DESC');
    if (req.user && req.user.role === 'state_admin') {
      const commissionedCodes = ['SG', 'SGS', 'SGT', 'GSH-S', 'GSH-DH', 'GSH', 'DHM', 'LXDG', 'XDG'];
      rows = rows.filter(r => {
        const code = String(r.rank_code || '').trim().toUpperCase();
        const name = String(r.rank_name || '').toLowerCase();
        return !commissionedCodes.includes(code) && !name.includes('sareeye') && !name.includes('gaashaanle') && !name.includes('dhamme') && !name.includes('xiddigle');
      });
    }
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

const CODE_MAP = {
  'Sareeye Guud': 'SG', 'Sareeye Gaas': 'SGS', 'Sareeye Guuto': 'SGT',
  'Gaashaanle Sare': 'GSH-S', 'Gaashaanle Dhexe': 'GSH-DH', 'Gaashaanle': 'GSH',
  'Dhamme': 'DHM', 'Laba Xiddigle': 'LXDG', 'Xiddigle': 'XDG',
  'Laba Xadhigle': 'LXDH', 'Xadhigle': 'XDH', 'Sadax Alifle': 'SA',
  'Labo Alifle': 'LA', 'Alifle': 'AL', 'Sadax Xadhigle': 'SXD',
};

exports.create = async (req, res, next) => {
  try {
    let { rank_name, rank_code, description } = req.body;
    if (!rank_name) return res.status(400).json({ success: false, message: 'Missing required fields' });
    if (!rank_code) {
      rank_code = CODE_MAP[rank_name] || rank_name.split(/\s+/).map(w => w[0]).join('').toUpperCase();
    }
    const creator = req.user?.username || 'system';

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
    let { rank_name, rank_code, description } = req.body;
    if (!rank_name) return res.status(400).json({ success: false, message: 'Missing required fields' });
    if (!rank_code) {
      rank_code = CODE_MAP[rank_name] || rank_name.split(/\s+/).map(w => w[0]).join('').toUpperCase();
    }

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
