'use strict';
const db = require('../config/database');
const fs = require('fs');
const path = require('path');
const { getUserLocation } = require('../utils/locationScope');
const { writeAuditLog } = require('../utils/auditLogger');

const STATE_ADMIN_RANK_CODES = new Set(['AL', 'SA', 'XDH', 'LXDH', 'LA', 'SXD']);

exports.getAll = async (req, res, next) => {
  try {
    const location=await getUserLocation(req.user); const params=[]; let scope='';
    if(req.user.role!=='admin'&&req.user.scopeType==='district'&&location.district_id){scope=' AND (o.district_id=? OR EXISTS(SELECT 1 FROM officer_assignments sx WHERE sx.officer_id=o.id AND sx.is_current=1 AND sx.assignment_type IN (\'District\',\'District Station\') AND sx.assignment_id=?))';params.push(location.district_id,location.district_id)}
    else if(req.user.role!=='admin'&&req.user.scopeType==='region'&&location.region_id){scope=' AND (o.region_id=? OR EXISTS(SELECT 1 FROM officer_assignments sx WHERE sx.officer_id=o.id AND sx.is_current=1 AND sx.assignment_type=\'Region\' AND sx.assignment_id=?))';params.push(location.region_id,location.region_id)}
    else if(req.user.role!=='admin'&&location.state_administration_id){scope=' AND o.state_administration_id=?';params.push(location.state_administration_id)}
    let query = `
      SELECT o.*, TIMESTAMPDIFF(YEAR,o.date_of_birth,CURDATE()) AS age, r.rank_name, r.rank_code,
        COALESCE(
          (
            SELECT CASE
              WHEN a.assignment_type = 'State Administration' THEN (SELECT state_name FROM state_administrations WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'State Unit' THEN (SELECT state_name FROM state_administrations WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'Region' THEN (SELECT region_name FROM regions WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'Region Unit' THEN (SELECT region_name FROM regions WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'District' THEN (SELECT district_name FROM districts WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'District Station' THEN (SELECT district_name FROM districts WHERE id = a.assignment_id)
              WHEN a.assignment_type = 'District User Link' THEN (
                SELECT d.district_name
                FROM users u
                LEFT JOIN districts d ON d.id = u.district_id
                WHERE u.id = a.assignment_id
              )
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
        ) AS current_assignment_type,
        (EXISTS(SELECT 1 FROM officer_transfers ot WHERE ot.officer_id = o.id AND LOWER(ot.transferred_by) IN ('admin', 'system')) OR LOWER(o.created_by) IN ('admin', 'system')) AS is_deployed_by_admin
      FROM police_officers o
      LEFT JOIN ranks r ON o.rank_id = r.id
      WHERE 1=1 ${scope}
    `;
    const [rows] = await db.query(query,params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(`
      SELECT o.*, TIMESTAMPDIFF(YEAR,o.date_of_birth,CURDATE()) AS age, r.rank_name, r.rank_code,
             registration_state.state_name AS registration_state_name,
             registration_region.region_name AS registration_region_name,
             registration_district.district_name AS registration_district_name,
             current_state.state_name AS current_state_name,
             current_region.region_name AS current_region_name,
             current_district.district_name AS current_district_name
      FROM police_officers o
      LEFT JOIN ranks r ON o.rank_id = r.id
      LEFT JOIN state_administrations registration_state ON registration_state.id=o.registration_state_administration_id
      LEFT JOIN regions registration_region ON registration_region.id=o.registration_region_id
      LEFT JOIN districts registration_district ON registration_district.id=o.registration_district_id
      LEFT JOIN state_administrations current_state ON current_state.id=o.state_administration_id
      LEFT JOIN regions current_region ON current_region.id=o.region_id
      LEFT JOIN districts current_district ON current_district.id=o.district_id
      WHERE o.id = ?
    `, [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Not found' });
    let officer = rows[0];
    
    // Transfer history
    const [transfers] = await db.query(`
      SELECT t.*,
        CASE t.from_assignment_type
          WHEN 'State Administration' THEN (SELECT state_name FROM state_administrations WHERE id=t.from_assignment_id)
          WHEN 'State Unit' THEN (SELECT state_name FROM state_administrations WHERE id=t.from_assignment_id)
          WHEN 'Region' THEN (SELECT region_name FROM regions WHERE id=t.from_assignment_id)
          WHEN 'Region Unit' THEN (SELECT region_name FROM regions WHERE id=t.from_assignment_id)
          WHEN 'District' THEN (SELECT district_name FROM districts WHERE id=t.from_assignment_id)
          WHEN 'District Station' THEN (SELECT district_name FROM districts WHERE id=t.from_assignment_id)
          WHEN 'District User Link' THEN (
            SELECT d.district_name
            FROM users u
            LEFT JOIN districts d ON d.id = u.district_id
            WHERE u.id=t.from_assignment_id
          )
        END AS from_assignment_name,
        CASE t.to_assignment_type
          WHEN 'State Administration' THEN (SELECT state_name FROM state_administrations WHERE id=t.to_assignment_id)
          WHEN 'State Unit' THEN (SELECT state_name FROM state_administrations WHERE id=t.to_assignment_id)
          WHEN 'Region' THEN (SELECT region_name FROM regions WHERE id=t.to_assignment_id)
          WHEN 'Region Unit' THEN (SELECT region_name FROM regions WHERE id=t.to_assignment_id)
          WHEN 'District' THEN (SELECT district_name FROM districts WHERE id=t.to_assignment_id)
          WHEN 'District Station' THEN (SELECT district_name FROM districts WHERE id=t.to_assignment_id)
          WHEN 'District User Link' THEN (
            SELECT d.district_name
            FROM users u
            LEFT JOIN districts d ON d.id = u.district_id
            WHERE u.id=t.to_assignment_id
          )
        END AS to_assignment_name
      FROM officer_transfers t WHERE t.officer_id=? ORDER BY t.transferred_at DESC`, [id]);
    officer.transfers = transfers;

    // Assignment history with dynamic tier name subqueries
    const [assignments] = await db.query(`
      SELECT a.*, 
        CASE 
          WHEN a.assignment_type = 'State Administration' THEN (SELECT state_name FROM state_administrations WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'State Unit' THEN (SELECT state_name FROM state_administrations WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'Region' THEN (SELECT region_name FROM regions WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'Region Unit' THEN (SELECT region_name FROM regions WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'District' THEN (SELECT district_name FROM districts WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'District Station' THEN (SELECT district_name FROM districts WHERE id = a.assignment_id)
          WHEN a.assignment_type = 'District User Link' THEN (
            SELECT d.district_name
            FROM users u
            LEFT JOIN districts d ON d.id = u.district_id
            WHERE u.id = a.assignment_id
          )
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
    const { full_name, mother_name, phone, gender, date_of_birth, address,
      national_id, department, position, employment_date, employment_status, weapons_issued, blood_group, station_id } = req.body;
    
    const validationError = validateOfficerInput(phone, date_of_birth);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }

    if(!full_name||!mother_name||!date_of_birth||!gender||!phone)return res.status(400).json({success:false,message:'Magaca, magaca hooyada, dhalashada, jinsiga iyo telefoonka waa wajib.'});
    if(!req.file)return res.status(400).json({success:false,message:'Sawirka askariga waa wajib; document ama fayl aan sawir ahayn lama oggola.'});
    const profile_image=req.file?'/uploads/officers/'+req.file.filename:null;
    let force_number=null;
    for(let attempt=0;attempt<5;attempt++){
      const year=new Date().getFullYear();const[[last]]=await db.query(`SELECT force_number FROM police_officers WHERE force_number LIKE ? ORDER BY CAST(SUBSTRING_INDEX(force_number,'-',-1) AS UNSIGNED) DESC LIMIT 1`,[`SPF-${year}-%`]);
      const next=(Number(String(last?.force_number||'').split('-').pop())||0)+1;force_number=`SPF-${year}-${String(next+attempt).padStart(5,'0')}`;
      const[[duplicate]]=await db.query('SELECT id FROM police_officers WHERE force_number=?',[force_number]);if(!duplicate)break;
    }

    const location=await getUserLocation(req.user); const directApproval=req.user.role==='admin';
    const [result] = await db.query(
      `INSERT INTO police_officers (full_name,mother_name, force_number, rank_id, phone, email, national_id, department, position, gender, date_of_birth, address, employment_date, profile_image, employment_status, weapons_issued, blood_group, station_id, created_by,approval_status,state_administration_id,region_id,district_id,registration_state_administration_id,registration_region_id,registration_district_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name, mother_name, force_number, null, phone, null, national_id||null, department||null, position||null, gender, date_of_birth, address || null, employment_date||null, profile_image,
        employment_status||'active', weapons_issued||null, blood_group||null, station_id||null, req.user.username,directApproval?'APPROVED':'PENDING',location.state_administration_id||null,location.region_id||null,location.district_id||null,
        location.state_administration_id||null,location.region_id||null,location.district_id||null
      ]
    );

    await db.query('INSERT INTO officer_approval_history(officer_id,previous_status,new_status,notes,performed_by) VALUES(?,NULL,?,?,?)',[result.insertId,directApproval?'APPROVED':'PENDING',directApproval?'Admin ayaa abuuray oo ansixiyey.':'Waxaa loo gudbiyey State Administration.',req.user.username]);
    res.json({ success: true, message: directApproval?'Sarkaalka waa la abuuray.':'Askariga waa la diiwaangeliyey, wuxuuna sugayaa State Administration.', id: result.insertId, force_number, profile_image });
  } catch (err) { 
    if(err.code === 'ER_DUP_ENTRY') return res.status(400).json({success: false, message: 'Force number already exists.'});
    next(err); 
  }
};

exports.reviewApproval=async(req,res,next)=>{try{const{status,rank_id,notes}=req.body;if(!['APPROVED','REJECTED','RETURNED'].includes(status))return res.status(400).json({success:false,message:'Xaalad sax ah dooro.'});const[[officer]]=await db.query('SELECT * FROM police_officers WHERE id=?',[req.params.id]);if(!officer)return res.status(404).json({success:false,message:'Askariga lama helin.'});if(status==='APPROVED'&&!rank_id)return res.status(400).json({success:false,message:'Darajo ayaa loo baahan yahay marka la ansixinayo.'});await db.query(`UPDATE police_officers SET approval_status=?,rank_id=COALESCE(?,rank_id),employment_status=?,approval_notes=?,approved_by=?,approved_at=IF(?='APPROVED',NOW(),approved_at) WHERE id=?`,[status,rank_id||null,status==='APPROVED'?'active':'inactive',notes||null,req.user.username,status,officer.id]);await db.query('INSERT INTO officer_approval_history(officer_id,previous_status,new_status,notes,performed_by) VALUES(?,?,?,?,?)',[officer.id,officer.approval_status,status,notes||null,req.user.username]);await writeAuditLog({userId:req.user.username,userEmail:req.user.email,action:'REVIEW_OFFICER_REGISTRATION',entityType:'police_officers',entityId:officer.id,oldData:{status:officer.approval_status},newData:{status,rank_id,notes}});res.json({success:true,message:status==='APPROVED'?'Askariga waa la ansixiyey oo la hawlgeliyey.':'Go’aanka waa la kaydiyey.'})}catch(e){next(e)}};

// Ansixintu waxay beddeshaa xaaladda ansixinta iyo darajada oo keliya.
// Xaaladda shaqadu waxay ahaanaysaa active laga bilaabo maalinta la diiwaangeliyo.
exports.reviewApproval = async (req, res, next) => {
  try {
    const { status, rank_id, notes } = req.body;
    if (!['APPROVED', 'REJECTED', 'RETURNED'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Xaalad sax ah dooro.' });
    }
    const [[officer]] = await db.query('SELECT * FROM police_officers WHERE id=?', [req.params.id]);
    if (!officer) return res.status(404).json({ success: false, message: 'Askariga lama helin.' });
    if (status === 'APPROVED' && !rank_id) {
      return res.status(400).json({ success: false, message: 'Darajo ayaa loo baahan yahay marka la ansixinayo.' });
    }
    if (status === 'APPROVED') {
      const [[rank]] = await db.query('SELECT rank_code FROM ranks WHERE id=?', [rank_id]);
      if (!rank) return res.status(400).json({ success: false, message: 'Darajada la doortay lama helin.' });
      if (req.user.role === 'state_admin' && !STATE_ADMIN_RANK_CODES.has(String(rank.rank_code).trim().toUpperCase())) {
        return res.status(403).json({
          success: false,
          message: 'State Administration wuxuu ansixin karaa oo keliya darajooyinka Al, SA, XDH, LXDH, LA iyo SXD.',
        });
      }
    }
    await db.query(
      `UPDATE police_officers
       SET approval_status=?, rank_id=COALESCE(?,rank_id), approval_notes=?, approved_by=?,
           approved_at=IF(?='APPROVED',NOW(),approved_at)
       WHERE id=?`,
      [status, rank_id || null, notes || null, req.user.username, status, officer.id]
    );
    await db.query(
      'INSERT INTO officer_approval_history(officer_id,previous_status,new_status,notes,performed_by) VALUES(?,?,?,?,?)',
      [officer.id, officer.approval_status, status, notes || null, req.user.username]
    );
    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email,
      action: 'REVIEW_OFFICER_REGISTRATION',
      entityType: 'police_officers',
      entityId: officer.id,
      oldData: { status: officer.approval_status },
      newData: { status, rank_id, notes },
    });
    res.json({ success: true, message: status === 'APPROVED' ? 'Askariga waa la ansixiyey.' : 'Go’aanka waa la kaydiyey.' });
  } catch (error) {
    next(error);
  }
};

exports.assignRank = async (req, res, next) => {
  try {
    const { rank_id, notes } = req.body;
    if (!rank_id) {
      return res.status(400).json({ success: false, message: 'Dooro darajada cusub.' });
    }
    const [[officer]] = await db.query('SELECT * FROM police_officers WHERE id = ?', [req.params.id]);
    if (!officer) return res.status(404).json({ success: false, message: 'Askariga lama helin.' });

    const [[rank]] = await db.query('SELECT id, rank_name, rank_code FROM ranks WHERE id = ?', [rank_id]);
    if (!rank) return res.status(400).json({ success: false, message: 'Darajada la doortay lama helin.' });

    if (req.user.role === 'state_admin') {
      const code = String(rank.rank_code || '').trim().toUpperCase();
      if (!STATE_ADMIN_RANK_CODES.has(code)) {
        return res.status(403).json({
          success: false,
          message: 'State Administration wuxuu bixin karaa oo keliya darajooyinka Al, SA, XDH, LXDH, LA iyo SXD.',
        });
      }
    }

    await db.query(
      `UPDATE police_officers
       SET rank_id = ?, approval_status = 'APPROVED', employment_status = 'active',
           approved_by = COALESCE(approved_by, ?), approved_at = COALESCE(approved_at, NOW())
       WHERE id = ?`,
      [rank_id, req.user.username, officer.id]
    );

    if (officer.approval_status !== 'APPROVED') {
      await db.query(
        'INSERT INTO officer_approval_history(officer_id, previous_status, new_status, notes, performed_by) VALUES(?, ?, ?, ?, ?)',
        [officer.id, officer.approval_status, 'APPROVED', notes || 'Darajo ayaa la siiyey, status-kiina wuxuu noqday APPROVED.', req.user.username]
      );
    }

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email,
      action: 'UPDATE_OFFICER_RANK',
      entityType: 'police_officers',
      entityId: officer.id,
      oldData: { rank_id: officer.rank_id, approval_status: officer.approval_status },
      newData: { rank_id, rank_name: rank.rank_name, approval_status: 'APPROVED', notes },
    });

    res.json({ success: true, message: `Darajada sarkaalka waa la bixiyey/badalay (${rank.rank_name}), status-kiisiina wuxuu noqday APPROVED.` });
  } catch (err) {
    next(err);
  }
};

exports.updateEmploymentStatus = async (req, res, next) => {
  try {
    const allowedRoles = new Set(['admin', 'state_admin', 'sub_admin']);
    if (!allowedRoles.has(String(req.user.role || '').toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'Xaaladda shaqada waxaa beddeli kara oo keliya Admin, State Admin ama Sub-Admin.',
      });
    }

    const { employment_status } = req.body;
    const allowedStatuses = new Set(['active', 'suspended', 'retired', 'inactive']);
    const normalizedStatus = String(employment_status || '').trim().toLowerCase();

    if (!allowedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ success: false, message: 'Xaaladda shaqada sax ah dooro.' });
    }

    const [[officer]] = await db.query(
      'SELECT id, full_name, employment_status FROM police_officers WHERE id = ?',
      [req.params.id]
    );
    if (!officer) {
      return res.status(404).json({ success: false, message: 'Askariga lama helin.' });
    }

    await db.query(
      'UPDATE police_officers SET employment_status = ? WHERE id = ?',
      [normalizedStatus, officer.id]
    );

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email,
      action: 'UPDATE_OFFICER_EMPLOYMENT_STATUS',
      entityType: 'police_officers',
      entityId: officer.id,
      oldData: { employment_status: officer.employment_status },
      newData: { employment_status: normalizedStatus },
    });

    res.json({
      success: true,
      message: `Xaaladda shaqada ee ${officer.full_name} waxaa loo beddelay ${normalizedStatus}.`,
    });
  } catch (err) {
    next(err);
  }
};

exports.update = async (req, res, next) => {
  try {
    const [[officer]] = await db.query('SELECT id, created_by FROM police_officers WHERE id = ?', [id]);
    if (!officer) return res.status(404).json({ success: false, message: 'Askariga lama helin.' });

    if (req.user.role !== 'admin') {
      const [[adminTransfer]] = await db.query(
        `SELECT id FROM officer_transfers WHERE officer_id = ? AND LOWER(transferred_by) IN ('admin', 'system') LIMIT 1`,
        [id]
      );
      if (adminTransfer || ['admin', 'system'].includes(String(officer.created_by || '').toLowerCase())) {
        return res.status(403).json({
          success: false,
          message: 'Ma beddeli kartid xogta sarkaalka uu Admin-ku soo wareejiyey ama soo qoondeeyey.'
        });
      }
    }

    const validationError = validateOfficerInput(phone, date_of_birth);
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    
    let query = `UPDATE police_officers SET full_name=?, mother_name=?, phone=?, gender=?, date_of_birth=?, address=?, national_id=?, department=?, position=?, employment_date=?, employment_status=?, weapons_issued=?, blood_group=?, station_id=?`;
    let params = [
      full_name, mother_name || null, phone || null, gender || null, date_of_birth || null, address || null,
      national_id||null, department||null, position||null, employment_date||null, employment_status||null, weapons_issued||null, blood_group||null, station_id||null
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
