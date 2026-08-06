'use strict';
const db = require('../config/database');
const bcrypt = require('bcryptjs');

const HIRAAN_DISTRICT_CODES = {
  Beledweyne: 'HIR-BLW', 'Buulo Burte': 'HIR-BBT', Jalalaqsi: 'HIR-JLL',
  Matabaan: 'HIR-MTB', Maxaas: 'HIR-MXS', Halgan: 'HIR-HLG',
  'Ceel-Cali': 'HIR-CCA', 'Far-Libaax': 'HIR-FLB', Moqokori: 'HIR-MQK',
  'Buq-Aqable': 'HIR-BQA', 'Booco/Burweyn': 'HIR-BBW', 'Cali-Gaduud': 'HIR-CGD',
  'Raage-Ceelle': 'HIR-RCL', Xawaadley: 'HIR-XWD',
};

const resolveDistrictCode = async (cityId, districtName, suppliedCode) => {
  const [[location]] = await db.query(
    `SELECT r.region_name FROM cities c JOIN regions r ON r.id=c.region_id WHERE c.id=?`,
    [cityId]
  );
  if (!location) return { error: 'Gobolka/xarunta la doortay lama helin.' };
  if (location.region_name === 'Hiiraan') {
    const code = HIRAAN_DISTRICT_CODES[String(districtName || '').trim()];
    if (!code) return { error: 'Degmada la doortay kama tirsana liiska degmooyinka Hiiraan.' };
    return { code };
  }
  return { code: String(suppliedCode || '').trim() || null };
};

const getOrCreateRegionCity = async (regionId, createdBy) => {
  const [[region]] = await db.query('SELECT id,region_name,region_code FROM regions WHERE id=?', [regionId]);
  if (!region) return null;
  const [[existing]] = await db.query('SELECT id FROM cities WHERE region_id=? ORDER BY id LIMIT 1', [regionId]);
  if (existing) return existing.id;
  const systemUsername = `${String(region.region_code).toLowerCase()}_districts`;
  const systemPasswordHash = await bcrypt.hash(`${region.region_code}-${Date.now()}-${Math.random()}`, 10);
  const [result] = await db.query(
    `INSERT INTO cities(region_id,city_name,city_code,username,password_hash,created_by)
     VALUES(?,?,?,?,?,?)`,
    [region.id, `${region.region_name} Xarunta Degmooyinka`, `${region.region_code}-CTR`, systemUsername, systemPasswordHash, createdBy]
  );
  return result.insertId;
};

exports.getAll = async (req, res, next) => {
  try { 
    let query = `
      SELECT c.id, c.district_name, c.district_code, c.username, c.commander_officer_id, c.city_id, ci.region_id, r.region_name, p.full_name as commander_name
      FROM districts c
      LEFT JOIN cities ci ON c.city_id = ci.id
      LEFT JOIN regions r ON r.id = ci.region_id
      LEFT JOIN police_officers p ON c.commander_officer_id = p.id
      WHERE 1=1
    `;
    const params = [];
    
    if (req.query.city_id) {
      query += ` AND c.city_id = ?`;
      params.push(req.query.city_id);
    }

    if (req.user.scopeType === 'state_administration') {
      query += ` AND ci.region_id IN (
        SELECT id FROM regions WHERE state_administration_id = ?
      )`;
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'region') {
      query += ` AND ci.region_id = ?`;
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'city') {
      query += ` AND c.city_id = ?`;
      params.push(req.user.scopeId);
    } else if (req.user.scopeType === 'district') {
      query += ` AND c.id = ?`;
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
      SELECT c.*, ci.region_id, p.full_name as commander_name, p.rank_id, rnk.rank_name as commander_rank, p.profile_image as commander_photo
      FROM districts c
      LEFT JOIN cities ci ON c.city_id = ci.id
      LEFT JOIN police_officers p ON c.commander_officer_id = p.id
      LEFT JOIN ranks rnk ON p.rank_id = rnk.id
      WHERE c.id = ?
    `, [id]);
    
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    // Authorize
    if (req.user.scopeType === 'district' && req.user.scopeId !== center.id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'city' && req.user.scopeId !== center.city_id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'region' && Number(req.user.scopeId) !== Number(center.region_id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const [officerRows] = await db.query(`
      SELECT count(id) as count FROM officer_assignments WHERE assignment_type = 'District' AND assignment_id = ? AND is_current = 1
    `, [id]);
    center.assigned_officer_count = officerRows[0].count;

    res.json({ success: true, data: center });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { district_name, district_code, username, password, commander_officer_id } = req.body;
    const region_id = req.user.scopeType === 'region' ? Number(req.user.scopeId) : Number(req.body.region_id);
    if (!region_id || !district_name || !username || !password) {
      return res.status(400).json({ success: false, message: 'Gobolka/xarunta, degmada, username-ka iyo password-ka waa wajib.' });
    }
    const city_id = await getOrCreateRegionCity(region_id, req.user.username);
    if (!city_id) return res.status(400).json({ success: false, message: 'Gobolka lama helin.' });
    const resolvedCode = await resolveDistrictCode(city_id, district_name, district_code);
    if (resolvedCode.error) return res.status(400).json({ success: false, message: resolvedCode.error });
    if (!resolvedCode.code) return res.status(400).json({ success: false, message: 'District Code waa wajib.' });
    
    if (req.user.scopeType === 'city' && req.user.scopeId !== parseInt(city_id)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (req.user.scopeType === 'region' && Number(req.user.scopeId) !== region_id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const hash = await bcrypt.hash(password, 10);
    const creator = req.user.username;

    const [result] = await db.query(`
      INSERT INTO districts (city_id, district_name, district_code, username, password_hash, commander_officer_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [city_id, district_name, resolvedCode.code, username, hash, commander_officer_id || null, creator]);
    res.json({ success: true, message: 'Created successfully', id: result.insertId });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Username or Code already exists.'});
    next(err); 
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { district_name, district_code, username, commander_officer_id } = req.body;
    const region_id = req.user.scopeType === 'region' ? Number(req.user.scopeId) : Number(req.body.region_id);
    const city_id = await getOrCreateRegionCity(region_id, req.user.username);
    if (!city_id) return res.status(400).json({ success: false, message: 'Gobolka lama helin.' });
    const resolvedCode = await resolveDistrictCode(city_id, district_name, district_code);
    if (resolvedCode.error) return res.status(400).json({ success: false, message: resolvedCode.error });
    if (!resolvedCode.code) return res.status(400).json({ success: false, message: 'District Code waa wajib.' });

    const [rows] = await db.query('SELECT * FROM districts WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const center = rows[0];

    if (req.user.scopeType === 'district' && req.user.scopeId !== parseInt(id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'city' && req.user.scopeId !== center.city_id) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.scopeType === 'region') {
      const [[currentCity]] = await db.query('SELECT region_id FROM cities WHERE id = ?', [center.city_id]);
      const [[targetCity]] = await db.query('SELECT region_id FROM cities WHERE id = ?', [city_id]);
      if (Number(currentCity?.region_id) !== Number(req.user.scopeId) || Number(targetCity?.region_id) !== Number(req.user.scopeId)) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }
    }

    await db.query(`
      UPDATE districts SET city_id=?, district_name=?, district_code=?, username=?, commander_officer_id=?
      WHERE id=?
    `, [city_id, district_name, resolvedCode.code, username, commander_officer_id || null, id]);
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
