'use strict';
const db = require('../config/database');
const fs = require('fs');
const path = require('path');

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
              WHEN a.assignment_type = 'Neighborhood' THEN (SELECT neighborhood_name FROM neighborhoods WHERE id = a.assignment_id)
              ELSE NULL
            END
            FROM officer_assignments a
            WHERE a.officer_id = o.id AND a.is_current = 1
            ORDER BY a.assigned_at DESC
            LIMIT 1
          ),
          (SELECT district_name FROM districts WHERE commander_officer_id = o.id LIMIT 1),
          (SELECT neighborhood_name FROM neighborhoods WHERE commander_officer_id = o.id LIMIT 1),
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
          (SELECT 'Waax Station' FROM neighborhoods WHERE commander_officer_id = o.id LIMIT 1),
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
          WHEN a.assignment_type = 'Neighborhood' THEN (SELECT neighborhood_name FROM neighborhoods WHERE id = a.assignment_id)
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

exports.create = async (req, res, next) => {
  try {
    const { full_name, force_number, rank_id, phone, email, gender, date_of_birth, address, employment_status } = req.body;
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
