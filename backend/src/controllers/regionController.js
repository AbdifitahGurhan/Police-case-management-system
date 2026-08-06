'use strict';
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { ensureHiiraanDistricts } = require('../utils/hiiraanDistrictCatalog');

const REGIONS_BY_STATE_CODE = {
  PNT: ['Bari', 'Nugaal', 'Mudug'],
  JBL: ['Gedo', 'Jubbada Dhexe', 'Jubbada Hoose'],
  HSH: ['Hiiraan', 'Shabeellaha Dhexe'],
  GLM: ['Galgaduud', 'Mudug'],
  SWS: ['Bakool', 'Bay', 'Shabeellaha Hoose'],
  SSC: ['Sool', 'Sanaag', 'Cayn'],
  BNDR: ['Banaadir'],
};

const REGION_CODE_SUFFIX = {
  Bari: 'BRI', Nugaal: 'NGL', Mudug: 'MDG', Gedo: 'GED',
  'Jubbada Dhexe': 'JDH', 'Jubbada Hoose': 'JHL', Hiiraan: 'HIR',
  'Shabeellaha Dhexe': 'SHD', Galgaduud: 'GLG', Bakool: 'BKL', Bay: 'BAY',
  'Shabeellaha Hoose': 'SHH', Sool: 'SOL', Sanaag: 'SNG', Cayn: 'CYN', Banaadir: 'BND',
};

const generateRegionCode = async (stateId, regionName) => {
  const [[state]] = await db.query('SELECT state_code FROM state_administrations WHERE id=?', [stateId]);
  const stateCode = String(state?.state_code || '').trim().toUpperCase();
  const suffix = REGION_CODE_SUFFIX[String(regionName || '').trim()];
  return stateCode && suffix ? `${stateCode}-${suffix}` : null;
};

const validateRegionForState = async (stateId, regionName) => {
  const [[state]] = await db.query('SELECT state_code FROM state_administrations WHERE id=?', [stateId]);
  if (!state) return 'State Administration-ka lama helin.';
  const allowed = REGIONS_BY_STATE_CODE[String(state.state_code).trim().toUpperCase()] || [];
  return allowed.includes(String(regionName || '').trim())
    ? null
    : `Gobolka la doortay kama tirsana State Administration-kan. Waxaa la oggol yahay: ${allowed.join(', ')}.`;
};

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

    if (req.user.role !== 'admin' && req.user.scopeType === 'state_administration') {
      query += ` AND r.state_administration_id = ?`;
      params.push(req.user.scopeId);
    } else if (req.user.role !== 'admin' && req.user.scopeType === 'region') {
      query += ` AND r.id = ?`;
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
    if (req.user.role !== 'admin' && req.user.scopeType === 'state_administration' && req.user.scopeId !== region.state_administration_id) return res.status(403).json({ success: false, message: 'Forbidden' });
    
    const [officerRows] = await db.query(`
      SELECT count(id) as count FROM officer_assignments WHERE assignment_type = 'Region' AND assignment_id = ? AND is_current = 1
    `, [id]);
    region.assigned_officer_count = officerRows[0].count;

    res.json({ success: true, data: region });
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  let connection;
  try {
    const { region_name, username, password, commander_officer_id } = req.body;
    const state_administration_id = req.user.role !== 'admin' && req.user.scopeType === 'state_administration'
      ? Number(req.user.scopeId)
      : Number(req.body.state_administration_id);
    
    // Auth check
    if (req.user.role !== 'admin' && req.user.scopeType === 'state_administration' && req.user.scopeId !== parseInt(state_administration_id)) {
      return res.status(403).json({ success: false, message: 'You can only create regions under your own state.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const creator = req.user.username;

    if(!region_name||!username||!password||!state_administration_id)return res.status(400).json({success:false,message:'Magaca gobolka, username-ka, password-ka iyo State-ka waa wajib.'});
    const regionValidationError = await validateRegionForState(state_administration_id, region_name);
    if (regionValidationError) return res.status(400).json({ success: false, message: regionValidationError });
    const region_code = await generateRegionCode(state_administration_id, region_name);
    if (!region_code) return res.status(400).json({ success: false, message: 'Region Code lama dhalin karin.' });
    connection=await db.pool.getConnection(); await connection.beginTransaction();
    const [result] = await connection.query(`
      INSERT INTO regions (state_administration_id, region_name, region_code, username, password_hash, commander_officer_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [state_administration_id, region_name, region_code, username, hash, commander_officer_id || null, creator]);
    await ensureHiiraanDistricts(connection, result.insertId, creator);
    const [[role]]=await connection.query("SELECT id FROM roles WHERE LOWER(name)='region_admin' LIMIT 1");
    if(!role)throw new Error('Region Administration role lama helin. Orod permissions migration.');
    await connection.query(`INSERT INTO users(role_id,username,full_name,password_hash,user_type,assigned_level,state_administration_id,region_id,is_commander,is_active,status,created_by)
      VALUES(?,?,?,?, 'COMMANDER','REGION',?,?,1,1,'ACTIVE',?)`,[role.id,String(username).trim().toLowerCase(),`${region_name} Administration`,hash,state_administration_id,result.insertId,creator]);
    await connection.commit();
    res.json({ success: true, message: 'Gobolka iyo koontada Region Administration si toos ah ayaa loo abuuray.', id: result.insertId });
  } catch (err) { 
    if(connection)await connection.rollback();
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Username or Code already exists.'});
    next(err); 
  } finally {if(connection)connection.release()}
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { region_name, username, password, commander_officer_id } = req.body;
    const state_administration_id = req.user.role !== 'admin' && req.user.scopeType === 'state_administration'
      ? Number(req.user.scopeId)
      : Number(req.body.state_administration_id);

    const [rows] = await db.query('SELECT * FROM regions WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    const region = rows[0];
    const effectiveStateId = req.user.role !== 'admin' && req.user.scopeType === 'state_administration'
      ? Number(req.user.scopeId)
      : Number(state_administration_id);

    // Auth check
    if (req.user.scopeType === 'region' && req.user.scopeId !== parseInt(id)) return res.status(403).json({ success: false, message: 'Forbidden' });
    if (req.user.role !== 'admin' && req.user.scopeType === 'state_administration' && req.user.scopeId !== region.state_administration_id) return res.status(403).json({ success: false, message: 'Forbidden' });

    const regionValidationError = await validateRegionForState(effectiveStateId, region_name);
    if (regionValidationError) return res.status(400).json({ success: false, message: regionValidationError });
    const region_code = await generateRegionCode(effectiveStateId, region_name);
    if (!region_code) return res.status(400).json({ success: false, message: 'Region Code lama dhalin karin.' });

    const hash=password?await bcrypt.hash(password,10):null;
    await db.query(`
      UPDATE regions SET state_administration_id=?, region_name=?, region_code=?, username=?, commander_officer_id=?
      WHERE id=?
    `, [effectiveStateId, region_name, region_code, username, commander_officer_id || null, id]);
    const updates=['username=?','full_name=?','state_administration_id=?'];const params=[String(username).trim().toLowerCase(),`${region_name} Administration`,effectiveStateId];if(hash){updates.push('password_hash=?');params.push(hash)}params.push(id);await db.query(`UPDATE users u JOIN roles ro ON ro.id=u.role_id SET ${updates.join(',')} WHERE u.region_id=? AND LOWER(ro.name)='region_admin'`,params);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query("UPDATE users u JOIN roles r ON r.id=u.role_id SET u.is_active=0,u.status='INACTIVE' WHERE u.region_id=? AND LOWER(r.name)='region_admin'",[id]);
    return res.status(409).json({success:false,message:'Gobol si rasmi ah looma tirtiro. Koontada Region Administration waa la joojiyey; xogta gobolka waa la ilaaliyey.'});
  } catch (err) { next(err); }
};
