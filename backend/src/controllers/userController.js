// src/controllers/userController.js — CRUD for user management (Admin only)
'use strict';

const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { normalizeRole } = require('../utils/locationScope');

const REGION_ASSIGNABLE_ROLES = new Set([
  'personnel_registry',
  'jail',
  'district_admin'
]);

const REGION_ASSIGNABLE_USER_TYPES = new Set(['OB_STAFF', 'STAFF', 'COMMANDER']);
const DISTRICT_OPERATIONAL_ROLES = new Set(['personnel_registry','ob_staff','investigator','station_jail']);
const DISTRICT_DEPLOY_TARGET_ROLES = new Set(['sub_admin', 'personnel_registry', 'ob_staff', 'investigator', 'station_jail']);

const HIERARCHY_PROFILE_TARGETS = {
  state_administration: { table: 'state_administrations', nameColumn: 'profile_name' },
  region: { table: 'regions', nameColumn: 'profile_name' },
  district: { table: 'districts', nameColumn: 'profile_name' },
};

const selfProfileUser = (req, values = {}) => ({
  ...req.user,
  role: normalizeRole(req.user.role),
  fullName: values.fullName ?? req.user.fullName,
  profileImage: values.profileImage ?? req.user.profileImage,
});

const ensureRegionAssignableRole = async (roleId) => {
  const [[role]] = await db.query('SELECT id, name FROM roles WHERE id = ?', [roleId]);
  if (!role || !REGION_ASSIGNABLE_ROLES.has(String(role.name).toLowerCase())) {
    const error = new Error('Regional accounts can only use regional operational roles.');
    error.statusCode = 403;
    throw error;
  }
  return role;
};

const ensureRegionInState = async (regionId, stateId) => {
  const [[region]] = await db.query(
    'SELECT id, state_administration_id FROM regions WHERE id = ? AND state_administration_id = ?',
    [regionId, stateId]
  );
  if (!region) {
    const error = new Error('Gobolka la doortay kama tirsana state-kaaga.');
    error.statusCode = 403;
    throw error;
  }
  return region;
};

const ensureCommanderAssignment = async ({ role_id, user_type, is_commander, district_id, state_administration_id }) => {
  const [[role]] = await db.query('SELECT name FROM roles WHERE id = ?', [role_id]);
  const roleName = normalizeRole(role?.name);
  const stationCommander = ['district_commander', 'police_station_commander'].includes(roleName)
    || user_type === 'COMMANDER' || Boolean(is_commander);
  if (stationCommander && !district_id && !state_administration_id) {
    const error = new Error('Commander or Station Commander must be assigned to exactly one police station or administration.');
    error.statusCode = 400;
    throw error;
  }
  if (district_id && state_administration_id && ['district_commander', 'police_station_commander'].includes(roleName)) {
    const error = new Error('Station Commander can only be directly assigned to one police station.');
    error.statusCode = 400;
    throw error;
  }
};

const mapAuthUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  role: row.role,
  roleCode: row.role,
  fullName: row.full_name,
  profileImage: row.profile_image,
  scopeType: null,
  scopeId: null
});

/** GET /api/users — List all users */
const getUsers = async (req, res, next) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.user.scopeType === 'state_administration') {
      where += ' AND u.state_administration_id = ? AND u.id != ? AND u.username != ?';
      params.push(req.user.scopeId, req.user.id, req.user.username);
    } else if (req.user.scopeType === 'region') {
      where += ' AND u.region_id = ? AND u.id != ? AND u.username != ?';
      params.push(req.user.scopeId, req.user.id, req.user.username);
    } else if (req.user.scopeType === 'district') {
      where += ' AND u.district_id = ? AND u.id != ? AND u.username != ?';
      params.push(req.user.scopeId, req.user.id, req.user.username);
    } else if (req.user.role !== 'admin' && !(req.user.permissions || []).includes('users.manage')) {
      where += ' AND 1=0';
    } else if (['region_admin', 'district_admin', 'state_admin'].includes(req.user.role)) {
      where += ' AND u.id != ? AND u.username != ?';
      params.push(req.user.id, req.user.username);
    }

    const [rows] = await db.query(
      `SELECT u.id, u.username, NULL AS badge_number, u.full_name, u.email, u.profile_image,
              u.phone, u.\`rank\`, u.user_type, u.assigned_level, u.is_commander,
              u.is_active, u.status, u.last_login, u.created_by, u.created_at,
              r.name AS role,
              u.district_id,
              sa.state_name,
              rg.region_name,
              d.district_name AS district_police_station_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN state_administrations sa ON u.state_administration_id = sa.id
       LEFT JOIN regions rg ON u.region_id = rg.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE ${where}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** GET /api/users/:id — Get single user */
const getUserById = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.police_officer_id, NULL AS badge_number, u.full_name, u.email, u.profile_image,
              u.phone, u.\`rank\`, u.user_type, u.assigned_level, u.is_commander,
              u.is_active, u.status, u.last_login, u.created_by,
              u.created_at, r.id AS role_id, r.name AS role,
              u.state_administration_id, u.region_id, u.district_id,
              sa.state_name, rg.region_name, d.district_name AS district_police_station_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN state_administrations sa ON u.state_administration_id = sa.id
       LEFT JOIN regions rg ON u.region_id = rg.id
       LEFT JOIN districts d ON u.district_id = d.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user.scopeType === 'region' && Number(rows[0].region_id) !== Number(req.user.scopeId)) {
      return res.status(403).json({ success: false, message: 'You can only view users within your assigned region.' });
    }
    if (req.user.scopeType === 'state_administration' && Number(rows[0].state_administration_id) !== Number(req.user.scopeId)) {
      return res.status(403).json({ success: false, message: 'You can only view users within your assigned state.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) { next(err); }
};

/** POST /api/users — Create new user */
const createUser = async (req, res, next) => {
  try {
    let {
      role_id, username, full_name, email, password, phone, rank, user_type,
      assigned_level, state_administration_id, region_id, district_id,
      is_commander, police_officer_id
    } = req.body;
    if (!password || !role_id) {
      return res.status(400).json({ success: false, message: 'password and role_id are required.' });
    }
    if (req.user.scopeType === 'region' || req.user.scopeType === 'state_administration') {
      if (req.user.scopeType === 'region') {
        region_id = req.user.scopeId;
        state_administration_id = req.user.location?.stateId || state_administration_id || null;
      } else {
        state_administration_id = req.user.scopeId;
        if (!region_id) {
          return res.status(400).json({ success: false, message: 'Dooro gobolka account-kan lagu xirayo.' });
        }
        await ensureRegionInState(region_id, req.user.scopeId);
      }
      const selectedRole=await ensureRegionAssignableRole(role_id); const roleName=normalizeRole(selectedRole.name);
      if(roleName==='district_admin'){
        if(!district_id)return res.status(400).json({success:false,message:'Dooro degmada District Administration-ku maamulayo.'});
        const [[district]]=await db.query('SELECT id, district_name FROM districts WHERE id = ? AND region_id = ?', [district_id, region_id]);
        if(!district)return res.status(403).json({success:false,message:'Degmada la doortay kama tirsana gobolkaaga.'});
        full_name=`${district.district_name} Administration`;assigned_level='DISTRICT_POLICE_STATION';user_type='COMMANDER';is_commander=1;
      }else{
        full_name=roleName==='personnel_registry'?'Diiwaanka Ciidanka':'Jail-ka Sare';assigned_level='REGION';user_type='STAFF';district_id=null;
      }
    }
    if (req.user.scopeType === 'district') {
      district_id=req.user.scopeId; assigned_level='DISTRICT_POLICE_STATION';
      const [[role]]=await db.query('SELECT id,name FROM roles WHERE id=?',[role_id]);
      const roleName=normalizeRole(role?.name);
      if(!DISTRICT_OPERATIONAL_ROLES.has(roleName))return res.status(403).json({success:false,message:'Degmadu waxay abuuri kartaa oo keliya Diiwaanka Ciidanka, OB Register, Baare ama Station Jail.'});
      if (police_officer_id) {
        const [[existingAssignment]]=await db.query(
          `SELECT r.name AS role_name FROM users u JOIN roles r ON r.id=u.role_id
           WHERE u.police_officer_id=? AND u.is_active=1 AND UPPER(COALESCE(u.status,'ACTIVE'))='ACTIVE' LIMIT 1`,
          [police_officer_id]
        );
        if(existingAssignment){
          const labels={investigator:'Baare',ob_staff:'OB Staff',station_jail:'Jail-ka Degmada',personnel_registry:'Diiwaanka Ciidanka',sub_admin:'Sub Admin'};
          const occupiedRole=normalizeRole(existingAssignment.role_name);
          return res.status(409).json({success:false,code:'OFFICER_ALREADY_ASSIGNED',currentRole:occupiedRole,message:`Askarigan hadda wuxuu ku qoran yahay shaqada ${labels[occupiedRole]||existingAssignment.role_name}. Lama siin karo shaqo kale.`});
        }
        const [[officer]]=await db.query(
          `SELECT po.*, r.rank_name
           FROM police_officers po
           LEFT JOIN ranks r ON r.id = po.rank_id
           LEFT JOIN officer_assignments oa ON oa.officer_id = po.id
            AND oa.is_current = 1
            AND oa.assignment_type IN ('District', 'District Station')
           WHERE po.id = ?
            AND (
              po.district_id = ?
              OR po.registration_district_id = ?
              OR oa.assignment_id = ?
            )
            AND po.approval_status = 'APPROVED'
            AND LOWER(po.employment_status) = 'active'`,
          [police_officer_id, district_id, district_id, district_id]
        );
        if(!officer)return res.status(409).json({success:false,message:'Sarkaalka lama heli karo, lama ansixin, ama user kale ayaa loo qoondeeyey.'});
        full_name=officer.full_name; rank=officer.rank_name; state_administration_id=officer.state_administration_id; region_id=officer.region_id||region_id;
      } else {
        const operationalNames = {
          personnel_registry: 'Diiwaanka Ciidanka',
          ob_staff: 'OB Register',
          investigator: 'Baare',
          station_jail: 'Station Jail',
        };
        full_name = full_name || operationalNames[roleName] || username || 'User Degmo';
        state_administration_id = state_administration_id || req.user.location?.stateId || null;
        region_id = region_id || req.user.location?.regionId || null;
        rank = rank || null;
      }
      user_type=roleName==='ob_staff'?'OB_STAFF':'STAFF';
    }
    const [[selectedRole]] = await db.query('SELECT name FROM roles WHERE id = ?', [role_id]);
    const selectedRoleName = normalizeRole(selectedRole?.name);
    if (selectedRoleName === 'sub_admin') {
      if (!police_officer_id) {
        return res.status(400).json({ success: false, message: 'Dooro sarkaalka loo sameynayo Sub-Admin.' });
      }
      const [[officer]] = await db.query(
        `SELECT po.full_name, po.phone, po.state_administration_id, po.region_id, po.district_id, r.rank_name
         FROM police_officers po
         LEFT JOIN ranks r ON r.id = po.rank_id
         WHERE po.id = ? AND po.approval_status = 'APPROVED' AND LOWER(po.employment_status) = 'active'`,
        [police_officer_id]
      );
      if (!officer) {
        return res.status(409).json({ success: false, message: 'Sarkaalka Sub-Admin lama heli karo ama weli lama ansixin.' });
      }
      full_name = officer.full_name;
      phone = phone || officer.phone || null;
      rank = officer.rank_name || rank || null;
      user_type = 'STAFF';
      assigned_level = assigned_level || 'ADMINISTRATION';
      state_administration_id = state_administration_id || officer.state_administration_id || null;
      region_id = region_id || officer.region_id || null;
      district_id = district_id || officer.district_id || null;
    }
    await ensureCommanderAssignment({ role_id, user_type, is_commander, district_id, state_administration_id });
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      `INSERT INTO users
        (role_id, username, full_name, email, phone, \`rank\`, user_type, assigned_level,
         state_administration_id, region_id, district_id,
         is_commander, password_hash, is_active, status, created_by,police_officer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'ACTIVE', ?, ?)`,
      [
        role_id,
        (username || email?.toLowerCase().split('@')[0] || full_name.toLowerCase().replace(/\s+/g, '.')).trim().toLowerCase(),
        full_name,
        email ? email.toLowerCase() : null,
        phone || null,
        rank || null,
        user_type || 'STAFF',
        assigned_level || null,
        state_administration_id || null,
        region_id || null,
        district_id || null,
        is_commander ? 1 : 0,
        hash,
        req.user.username || req.user.id, police_officer_id||null,
      ]
    );
    await writeAuditLog({
      userId: req.user.id, userEmail: req.user.email,
      action: 'CREATE_USER', entityType: 'users', entityId: result.insertId,
      newData: { full_name, email, role_id, user_type, assigned_level, state_administration_id, region_id, district_id },
    });
    res.status(201).json({ success: true, message: 'User created.', userId: result.insertId });
  } catch (err) { next(err); }
};

/** PUT /api/users/:id — Update user */
const updateUser = async (req, res, next) => {
  try {
    let {
      full_name, email, username, role_id, is_active, status, password, phone, rank,
      user_type, assigned_level, state_administration_id, region_id, district_id,
      is_commander
    } = req.body;
    const [existing] = await db.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.user.scopeType === 'state_administration' && Number(existing[0].state_administration_id) !== Number(req.user.scopeId)) {
      return res.status(403).json({ success: false, message: 'You can only manage users within your assigned state.' });
    }
    if (req.user.scopeType === 'region' && Number(existing[0].region_id) !== Number(req.user.scopeId)) {
      return res.status(403).json({ success: false, message: 'You can only manage users within your assigned region.' });
    }
    if (req.user.scopeType === 'state_administration') {
      state_administration_id = req.user.scopeId;
      if (region_id !== undefined && region_id !== null) {
        await ensureRegionInState(region_id, req.user.scopeId);
      }
      if (user_type && !REGION_ASSIGNABLE_USER_TYPES.has(user_type)) {
        return res.status(403).json({ success: false, message: 'State admins can only manage state regional staff accounts.' });
      }
      if (role_id) {
        await ensureRegionAssignableRole(role_id);
      }
    }
    if (req.user.scopeType === 'region') {
      region_id = req.user.scopeId;
      if (user_type && !REGION_ASSIGNABLE_USER_TYPES.has(user_type)) {
        return res.status(403).json({ success: false, message: 'Region admins can only manage regional staff accounts.' });
      }
      if (role_id) {
        await ensureRegionAssignableRole(role_id);
      }
    }
    await ensureCommanderAssignment({
      role_id: role_id || existing[0].role_id,
      user_type: user_type || existing[0].user_type,
      is_commander: is_commander === undefined ? existing[0].is_commander : is_commander,
      district_id: district_id === undefined ? existing[0].district_id : district_id,
      state_administration_id: state_administration_id === undefined ? existing[0].state_administration_id : state_administration_id,
    });

    let hashUpdate = '';
    const params = [];

    if (full_name) { params.push(['full_name', full_name]); }
    if (email) { params.push(['email', email.toLowerCase()]); }
    if (username) { params.push(['username', username]); }
    if (role_id) { params.push(['role_id', role_id]); }
    if (is_active !== undefined) { params.push(['is_active', is_active ? 1 : 0]); }
    if (status) { params.push(['status', status]); }
    if (phone !== undefined) { params.push(['phone', phone || null]); }
    if (rank !== undefined) { params.push(['`rank`', rank || null]); }
    if (user_type) { params.push(['user_type', user_type]); }
    if (assigned_level !== undefined) { params.push(['assigned_level', assigned_level || null]); }
    if (state_administration_id !== undefined) { params.push(['state_administration_id', state_administration_id || null]); }
    if (region_id !== undefined) { params.push(['region_id', region_id || null]); }
    if (district_id !== undefined) { params.push(['district_id', district_id || null]); }
    if (is_commander !== undefined) { params.push(['is_commander', is_commander ? 1 : 0]); }
    if (req.body.police_officer_id !== undefined) { params.push(['police_officer_id', req.body.police_officer_id || null]); }

    if (!params.length && !password) {
      return res.status(400).json({ success: false, message: 'No update fields provided.' });
    }

    const setClauses = params.map(([col]) => `${col} = ?`).join(', ');
    const values = params.map(([, v]) => v);

    let sql = `UPDATE users SET ${setClauses || 'updated_at = updated_at'}`;
    if (password) {
      const newHash = await bcrypt.hash(password, 12);
      sql += ', password_hash = ?';
      values.push(newHash);
    }
    sql += ' WHERE id = ?';
    values.push(req.params.id);

    await db.query(sql, values);
    await writeAuditLog({
      userId: req.user.id, userEmail: req.user.email,
      action: 'UPDATE_USER', entityType: 'users', entityId: parseInt(req.params.id),
      oldData: existing[0], newData: req.body,
    });
    res.json({ success: true, message: 'User updated.' });
  } catch (err) { next(err); }
};

/** POST /api/users/me/profile-image — Update signed-in user's profile photo */
const updateMyProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload an image file.' });
    }

    const profileImage = `/uploads/profiles/${req.file.filename}`;
    const hierarchyTarget = HIERARCHY_PROFILE_TARGETS[req.user.scopeType];
    if (hierarchyTarget) {
      await db.query(
        `UPDATE ${hierarchyTarget.table} SET profile_image = ? WHERE id = ?`,
        [profileImage, req.user.scopeId]
      );
    } else {
      await db.query('UPDATE users SET profile_image = ? WHERE id = ?', [profileImage, req.user.id]);
    }

    const [rows] = hierarchyTarget ? [[{ id: req.user.id }]] : await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.profile_image, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_PROFILE_IMAGE',
      entityType: 'users',
      entityId: req.user.id,
      newData: { profile_image: profileImage },
    });

    res.json({
      success: true,
      message: 'Profile image updated.',
      profileImage,
      user: hierarchyTarget
        ? selfProfileUser(req, { profileImage })
        : mapAuthUser(rows[0])
    });
  } catch (err) { next(err); }
};

/** PUT /api/users/me — Update signed-in user's profile details */
const updateMyProfile = async (req, res, next) => {
  try {
    const { full_name, username, email, password } = req.body;
    if (username && username.trim().toLowerCase() !== String(req.user.username).toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Username cannot be changed.' });
    }

    const hierarchyTarget = HIERARCHY_PROFILE_TARGETS[req.user.scopeType];
    if (hierarchyTarget) {
      if (!full_name?.trim()) {
        return res.status(400).json({ success: false, message: 'Full name is required.' });
      }
      await db.query(
        `UPDATE ${hierarchyTarget.table} SET ${hierarchyTarget.nameColumn} = ? WHERE id = ?`,
        [full_name.trim(), req.user.scopeId]
      );
      await writeAuditLog({
        userId: req.user.username,
        userEmail: req.user.email || req.user.username,
        action: 'UPDATE_MY_PROFILE',
        entityType: hierarchyTarget.table,
        entityId: req.user.scopeId,
        newData: { full_name: full_name.trim() },
      });
      return res.json({
        success: true,
        message: 'Profile updated.',
        user: selfProfileUser(req, { fullName: full_name.trim() }),
      });
    }

    const [existing] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!existing.length) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updates = [];
    const values = [];

    if (full_name) {
      updates.push('full_name = ?');
      values.push(full_name.trim());
    }
    if (email) {
      updates.push('email = ?');
      values.push(email.trim().toLowerCase());
    }
    if (password) {
      const newHash = await bcrypt.hash(password, 12);
      updates.push('password_hash = ?');
      values.push(newHash);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No profile fields provided.' });
    }

    values.push(req.user.id);
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const [rows] = await db.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.profile_image, r.name AS role
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    await writeAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_MY_PROFILE',
      entityType: 'users',
      entityId: req.user.id,
      oldData: existing[0],
      newData: { full_name, email, passwordChanged: Boolean(password) },
    });

    res.json({
      success: true,
      message: 'Profile updated.',
      user: { ...mapAuthUser(rows[0]), role: normalizeRole(rows[0].role) }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Username or email is already in use.' });
    }
    next(err);
  }
};

/** DELETE /api/users/:id — Deactivate user (soft delete) */
const deleteUser = async (req, res, next) => {
  try {
    if (req.user.scopeType === 'state_administration') {
      const [[existing]] = await db.query('SELECT state_administration_id FROM users WHERE id = ?', [req.params.id]);
      if (!existing || Number(existing.state_administration_id) !== Number(req.user.scopeId)) {
        return res.status(403).json({ success: false, message: 'You can only manage users within your assigned state.' });
      }
    } else if (req.user.scopeType === 'region') {
      const [[existing]] = await db.query('SELECT region_id FROM users WHERE id = ?', [req.params.id]);
      if (!existing || Number(existing.region_id) !== Number(req.user.scopeId)) {
        return res.status(403).json({ success: false, message: 'You can only manage users within your assigned region.' });
      }
    }
    await db.query("UPDATE users SET is_active = 0, status = 'INACTIVE' WHERE id = ?", [req.params.id]);
    await writeAuditLog({
      userId: req.user.id, userEmail: req.user.email,
      action: 'DEACTIVATE_USER', entityType: 'users', entityId: parseInt(req.params.id),
    });
    res.json({ success: true, message: 'User deactivated.' });
  } catch (err) { next(err); }
};

const DEPRECATED_ROLES = new Set([
  'officer',
  'taliyaha_saldhiga',
  'police_station_commander',
  'prosecutor',
  'taliyaha-gobolka',
  'region_commander',
  'staff',
  'taliyaha maamul goboleedka',
  'state_commander',
  'ward_commander',
  'garsoore',
  'judge',
  'taliyaha degmada',
  'district_commander',
]);

/** GET /api/users/roles — Get all roles */
const getRoles = async (req, res, next) => {
  try {
    const params = [];
    let where = '1=1';
    if (req.user.scopeType === 'region') {
      const assignableRoles = Array.from(REGION_ASSIGNABLE_ROLES);
      where = `LOWER(name) IN (${assignableRoles.map(() => '?').join(', ')})`;
      params.push(...assignableRoles);
    }
    if (req.user.scopeType === 'district') {
      const allowed = [...DISTRICT_OPERATIONAL_ROLES];
      where = `LOWER(name) IN (${allowed.map(() => '?').join(',')})`;
      params.push(...allowed);
    }
    const [rows] = await db.query(`SELECT * FROM roles WHERE ${where} ORDER BY id`, params);
    const filteredRows = rows.filter(r => !DEPRECATED_ROLES.has(String(r.name || '').toLowerCase()));
    res.json({ success: true, data: filteredRows });
  } catch (err) { next(err); }
};

const getAssignableOfficers = async (req, res, next) => {
  try {
    if (req.user.scopeType !== 'district' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Degmo keliya ayaa saraakiil u xilsaari karta roles-kan.' });
    }
    const params = [];
    let where = "po.approval_status='APPROVED' AND LOWER(po.employment_status)='active'";
    let assignmentJoin = '';
    if (req.user.scopeType === 'district') {
      assignmentJoin = `
       LEFT JOIN officer_assignments oa ON oa.officer_id = po.id
        AND oa.is_current = 1
        AND oa.assignment_type IN ('District', 'District Station')`;
      where += ' AND (po.district_id=? OR po.registration_district_id=? OR oa.assignment_id=?)';
      params.push(req.user.scopeId, req.user.scopeId, req.user.scopeId);
    }
    const [rows] = await db.query(
      `SELECT DISTINCT po.id, po.full_name, po.force_number, r.rank_name, r.rank_code, po.district_id,
              u.id AS assigned_user_id, ur.name AS assigned_role
       FROM police_officers po
       LEFT JOIN ranks r ON r.id = po.rank_id
       LEFT JOIN users u ON u.police_officer_id = po.id AND u.is_active=1 AND UPPER(COALESCE(u.status,'ACTIVE'))='ACTIVE'
       LEFT JOIN roles ur ON ur.id = u.role_id
       ${assignmentJoin}
       WHERE ${where}
       ORDER BY po.full_name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (e) {
    next(e);
  }
};

const getSubAdmins = async (req, res, next) => {
  try {
    let where = `u.is_active = 1
      AND UPPER(COALESCE(u.status, 'ACTIVE')) = 'ACTIVE'
      AND LOWER(REPLACE(r.name, '-', '_')) IN (${[...DISTRICT_DEPLOY_TARGET_ROLES].map(() => '?').join(',')})`;
    const params = [...DISTRICT_DEPLOY_TARGET_ROLES];

    if (req.user?.scopeType === 'district') {
      where += ` AND u.district_id = ?`;
      params.push(req.user.scopeId);
    } else if (req.user?.scopeType === 'region') {
      where += ` AND u.region_id = ?`;
      params.push(req.user.scopeId);
    }

    const [rows] = await db.query(
      `SELECT u.id, u.username,
              COALESCE(NULLIF(u.full_name, ''), po.full_name, u.username) AS full_name,
              u.email,
              COALESCE(NULLIF(u.rank, ''), rk.rank_name) AS \`rank\`,
              u.user_type,
              u.police_officer_id,
              u.state_administration_id,
              u.region_id,
              u.district_id,
              r.name AS role
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN police_officers po ON po.id = u.police_officer_id
       LEFT JOIN ranks rk ON rk.id = po.rank_id
       WHERE ${where}
       ORDER BY full_name, u.username`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

module.exports = { getUsers, getUserById, createUser, updateUser, updateMyProfile, updateMyProfileImage, deleteUser, getRoles, getAssignableOfficers, getSubAdmins };
