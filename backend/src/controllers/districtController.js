'use strict';

const db = require('../config/database');
const bcrypt = require('bcryptjs');

const HIRAAN_DISTRICT_CODES = {
  Beledweyne: 'HIR-BLW',
  'Buulo Burte': 'HIR-BBT',
  Jalalaqsi: 'HIR-JLL',
  Matabaan: 'HIR-MTB',
  Maxaas: 'HIR-MXS',
  Halgan: 'HIR-HLG',
  'Ceel-Cali': 'HIR-CCA',
  'Far-Libaax': 'HIR-FLB',
  Moqokori: 'HIR-MQK',
  'Buq-Aqable': 'HIR-BQA',
  'Booco/Burweyn': 'HIR-BBW',
  'Cali-Gaduud': 'HIR-CGD',
  'Raage-Ceelle': 'HIR-RCL',
  Xawaadley: 'HIR-XWD',
};

const resolveDistrictCode = async (regionId, districtName, suppliedCode) => {
  const [[location]] = await db.query('SELECT region_name FROM regions WHERE id = ?', [regionId]);
  if (!location) return { error: 'Gobolka la doortay lama helin.' };
  if (location.region_name === 'Hiiraan') {
    const code = HIRAAN_DISTRICT_CODES[String(districtName || '').trim()];
    if (!code) return { error: 'Degmada la doortay kama tirsana liiska degmooyinka Hiiraan.' };
    return { code };
  }
  return { code: String(suppliedCode || '').trim() || null };
};

const canUseRegion = async (req, regionId) => {
  if (req.user.scopeType === 'region') return Number(req.user.scopeId) === Number(regionId);
  if (req.user.scopeType === 'state_administration') {
    const [[row]] = await db.query('SELECT id FROM regions WHERE id = ? AND state_administration_id = ?', [regionId, req.user.scopeId]);
    return Boolean(row);
  }
  return !req.user.scopeType || req.user.role === 'admin';
};

exports.getAll = async (req, res, next) => {
  try {
    let query = `
      SELECT d.id, d.district_name, d.district_code, d.username, d.commander_officer_id,
             d.region_id, r.region_name, p.full_name AS commander_name
      FROM districts d
      LEFT JOIN regions r ON d.region_id = r.id
      LEFT JOIN police_officers p ON d.commander_officer_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.region_id) {
      query += ' AND d.region_id = ?';
      params.push(req.query.region_id);
    }

    if (req.user.scopeType === 'state_administration') {
      query += ' AND r.state_administration_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'region') {
      query += ' AND d.region_id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'district') {
      query += ' AND d.id = ?';
      params.push(req.user.scopeId);
    } else if (req.user.scopeType && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const [rows] = await db.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      `SELECT d.*, p.full_name AS commander_name, p.rank_id, rnk.rank_name AS commander_rank,
              p.profile_image AS commander_photo, r.state_administration_id
       FROM districts d
       LEFT JOIN regions r ON d.region_id = r.id
       LEFT JOIN police_officers p ON d.commander_officer_id = p.id
       LEFT JOIN ranks rnk ON p.rank_id = rnk.id
       WHERE d.id = ?`,
      [id]
    );

    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    if (req.user.scopeType === 'district' && Number(req.user.scopeId) !== Number(center.id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'region' && Number(req.user.scopeId) !== Number(center.region_id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'state_administration' && Number(req.user.scopeId) !== Number(center.state_administration_id)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const [officerRows] = await db.query(
      `SELECT COUNT(id) AS count
       FROM officer_assignments
       WHERE assignment_type = 'District' AND assignment_id = ? AND is_current = 1`,
      [id]
    );
    center.assigned_officer_count = officerRows[0].count;

    res.json({ success: true, data: center });
  } catch (err) {
    next(err);
  }
};

exports.create = async (req, res, next) => {
  try {
    const { district_name, district_code, username, password, commander_officer_id } = req.body;
    const region_id = req.user.scopeType === 'region' ? Number(req.user.scopeId) : Number(req.body.region_id);
    if (!region_id || !district_name || !username || !password) {
      return res.status(400).json({ success: false, message: 'Gobolka, degmada, username-ka iyo password-ka waa wajib.' });
    }
    if (!(await canUseRegion(req, region_id))) return res.status(403).json({ success: false, message: 'Forbidden' });

    const resolvedCode = await resolveDistrictCode(region_id, district_name, district_code);
    if (resolvedCode.error) return res.status(400).json({ success: false, message: resolvedCode.error });
    if (!resolvedCode.code) return res.status(400).json({ success: false, message: 'District Code waa wajib.' });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      `INSERT INTO districts (region_id, district_name, district_code, username, password_hash, commander_officer_id, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [region_id, district_name, resolvedCode.code, username, hash, commander_officer_id || null, req.user.username]
    );
    res.json({ success: true, message: 'Created successfully', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'Username or Code already exists.' });
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { district_name, district_code, username, commander_officer_id } = req.body;
    const region_id = req.user.scopeType === 'region' ? Number(req.user.scopeId) : Number(req.body.region_id);
    if (!region_id) return res.status(400).json({ success: false, message: 'Gobolka waa wajib.' });
    if (!(await canUseRegion(req, region_id))) return res.status(403).json({ success: false, message: 'Forbidden' });

    const [rows] = await db.query('SELECT * FROM districts WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    if (req.user.scopeType === 'district' && Number(req.user.scopeId) !== Number(id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'region' && Number(req.user.scopeId) !== Number(center.region_id)) return res.status(403).json({ success: false, message: 'Forbidden' });

    const resolvedCode = await resolveDistrictCode(region_id, district_name, district_code);
    if (resolvedCode.error) return res.status(400).json({ success: false, message: resolvedCode.error });
    if (!resolvedCode.code) return res.status(400).json({ success: false, message: 'District Code waa wajib.' });

    await db.query(
      `UPDATE districts
       SET region_id = ?, district_name = ?, district_code = ?, username = ?, commander_officer_id = ?
       WHERE id = ?`,
      [region_id, district_name, resolvedCode.code, username, commander_officer_id || null, id]
    );
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    next(err);
  }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM districts WHERE id = ?', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    next(err);
  }
};
