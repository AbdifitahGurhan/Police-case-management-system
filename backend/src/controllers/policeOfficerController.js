'use strict';
const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const { getUserLocation } = require('../utils/locationScope');

exports.getAll = async (req, res, next) => {
  try {
    let query = `
      SELECT o.*, r.rank_name,
        COALESCE(
          (
            SELECT CASE
              WHEN a.assignment_type = 'State Administration' THEN (SELECT state_name FROM state_administrations WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'Region' THEN (SELECT region_name FROM regions WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'City' THEN (SELECT city_name FROM cities WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'District' THEN (SELECT district_name FROM districts WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'District Station' THEN (SELECT district_name FROM districts WHERE id = a.assignment_id)
              ELSE NULL
            END
            FROM officer_assignments a
            WHERE a.officer_id = o.id AND a.is_current = 1
            ORDER BY a.assigned_at DESC
            LIMIT 1
          ),
          (SELECT district_name FROM districts WHERE commander_officer_id = o.id LIMIT 1),
          (SELECT region_name FROM regions WHERE commander_officer_id = o.id LIMIT 1),
          (SELECT state_name FROM state_administrations WHERE commander_officer_id = o.id LIMIT 1)
        ) AS current_assignment_name,
        COALESCE(
          (
            SELECT a.assignment_type
            FROM officer_assignments a
            WHERE a.officer_id = o.id AND a.is_current = 1
            ORDER BY a.assigned_at DESC
            LIMIT 1
          ),
          (SELECT 'District / Police Station' FROM districts WHERE commander_officer_id = o.id LIMIT 1),
          (SELECT 'Region' FROM regions WHERE commander_officer_id = o.id LIMIT 1),
          (SELECT 'State Administration' FROM state_administrations WHERE commander_officer_id = o.id LIMIT 1),
          'Unassigned'
        ) AS current_assignment_type
      FROM police_officers o
      LEFT JOIN ranks r ON o.rank_id = r.id
      WHERE 1=1
    `;
    const [rows] = await db.query(query);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT o.*, r.rank_name 
      FROM police_officers o
      LEFT JOIN ranks r ON o.rank_id = r.id
      WHERE o.id = ?
    `, [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    let officer = rows[0];
    
    // Transfer history
    const [transfers] = await db.query('SELECT * FROM officer_transfers WHERE officer_id = ? ORDER BY transferred_at DESC', [id]);
    officer.transfers = transfers;

    // Assignment history with dynamic tier name subqueries
    const [assignments] = await db.query(`
      SELECT a.*, 
        CASE 
          WHEN a.assignment_type = 'State Administration' THEN (SELECT state_name FROM state_administrations WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'Region' THEN (SELECT region_name FROM regions WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'City' THEN (SELECT city_name FROM cities WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'District' THEN (SELECT district_name FROM districts WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'District Station' THEN (SELECT district_name FROM districts WHERE id = a.assignment_id)
          ELSE 'Unknown'
        END as assignment_name
      FROM officer_assignments a 
      WHERE a.officer_id = ? 
      ORDER BY a.assigned_at DESC
    `, [id]);
    officer.assignments = assignments;

    const currentReq = assignments.find(a => a.is_current === 1);
    if (currentReq) {
      officer.current_assignment_type = currentReq.assignment_type;
      officer.current_assignment_name = currentReq.assignment_name;
    } else {
      officer.current_assignment_type = 'Unassigned';
      officer.current_assignment_name = 'Headquarters';
    }

    res.json({ success: true, data: officer });
  } catch (err) { next(err); }
};

const validateOfficerInput = (phone, date_of_birth) => {
  if (phone) {
    const cleaned = String(phone).trim().replace(/[\s-]/g, '');
    const somaliPhoneRegex = /^(\+?252|0)?(6[1-9]|7[7-9]|90)\d{7,8}$/;
    if (!somaliPhoneRegex.test(cleaned)) {
      return 'Fadlan geli lambar teleefon oo Soomaali ah oo sax ah (tusaale: +25261XXXXXXX ama 061XXXXXXX).';
    }
  }
  if (date_of_birth) {
    const dob = new Date(date_of_birth);
    if (!isNaN(dob.getTime())) {
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
      }
      if (age < 18) {
        return 'Da\'da saraakiisha waa inay ahaataa ugu yaraan 18 sano.';
      }
    }
  }
  return null;
};

exports.create = async (req, res, next) => {
  try {
    const { full_name, force_number, rank_id, phone, email, gender, date_of_birth, address, employment_status } = req.body;
    
    const validationError = validateOfficerInput(phone, date_of_birth);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    let profile_image = req.file ? '/uploads/officers/' + req.file.filename : null;

    const [result] = await db.query(
      `INSERT INTO police_officers (full_name, force_number, rank_id, phone, email, gender, date_of_birth, address, profile_image, employment_status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name, 
        force_number, 
        rank_id, 
        phone || null, 
        email || null, 
        gender || null, 
        date_of_birth || null, 
        address || null, 
        profile_image || null, 
        employment_status || 'Active', 
        req.user.username
      ]
    );

    res.json({ success: true, message: 'Created successfully', id: result.insertId, profile_image });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Force number already exists.'});
    next(err); 
  }
};

exports.update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { full_name, force_number, rank_id, phone, email, gender, date_of_birth, address, employment_status } = req.body;

    const validationError = validateOfficerInput(phone, date_of_birth);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    
    let query = `UPDATE police_officers SET full_name=?, force_number=?, rank_id=?, phone=?, email=?, gender=?, date_of_birth=?, address=?, employment_status=?`;
    let params = [
      full_name, 
      force_number, 
      rank_id, 
      phone || null, 
      email || null, 
      gender || null, 
      date_of_birth || null, 
      address || null, 
      employment_status || 'Active'
    ];

    if (req.file) {
      query += `, profile_image=?`;
      params.push('/uploads/officers/' + req.file.filename);
    }

    query += ` WHERE id=?`;
    params.push(id);

    await db.query(query, params);
    res.json({ success: true, message: 'Updated successfully' });
  } catch (err) { next(err); }
};

exports.delete = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('DELETE FROM police_officers WHERE id=?', [id]);
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) { next(err); }
};

exports.getDeployedOfficers = async (req, res, next) => {
  try {
    const location = await getUserLocation(req.user);
    const params = [];
    let whereClauses = [];

    if (location.district_id) {
      whereClauses.push("(oa.assignment_type IN ('District', 'District Station') AND oa.assignment_id = ?)");
      params.push(location.district_id);
    }
    if (location.region_id) {
      whereClauses.push("(oa.assignment_type = 'Region' AND oa.assignment_id = ?)");
      params.push(location.region_id);
    }
    if (location.state_administration_id) {
      whereClauses.push("(oa.assignment_type = 'State Administration' AND oa.assignment_id = ?)");
      params.push(location.state_administration_id);
    }

    let sql = `
      SELECT DISTINCT po.id, po.full_name, po.force_number, po.rank_id, r.rank_name
      FROM police_officers po
      LEFT JOIN ranks r ON po.rank_id = r.id
      LEFT JOIN officer_assignments oa ON oa.officer_id = po.id AND oa.is_current = 1
      WHERE po.employment_status = 'Active'
    `;

    if (whereClauses.length > 0) {
      sql += ` AND (${whereClauses.join(' OR ')})`;
    }

    sql += ` ORDER BY oa.assigned_at DESC, po.full_name ASC`;

    const [rows] = await db.query(sql, params);

    const [[userOfficer]] = await db.query(
      `SELECT po.id, po.full_name, po.force_number, r.rank_name 
       FROM police_officers po 
       LEFT JOIN ranks r ON po.rank_id = r.id 
       WHERE LOWER(po.email) = LOWER(?) OR LOWER(po.full_name) = LOWER(?) OR po.force_number = ? LIMIT 1`,
      [req.user.email || '', req.user.fullName || '', req.user.username || '']
    );

    let officerList = [...rows];
    if (userOfficer && !officerList.some(o => o.id === userOfficer.id)) {
      officerList.unshift(userOfficer);
    }

    let primaryDeployed = officerList.length > 0 ? officerList[0] : null;

    res.json({
      success: true,
      deployedOfficer: primaryDeployed,
      officers: officerList
    });
  } catch (err) {
    next(err);
  }
};
