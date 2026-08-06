'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const districtId = (req) => Number(req.user?.scopeType === 'district' ? req.user.scopeId : req.query.district_id || req.body.district_id);
const terminalStatuses = "('closed','CLOSED','court_decided','REJECTED')";

const getDistrictOperations = async (req, res, next) => {
  try {
    const id = districtId(req);
    if (!id) return res.status(400).json({ success: false, message: 'District scope is required.' });

    const [[district]] = await db.query('SELECT id, district_name, district_code FROM districts WHERE id = ?', [id]);
    if (!district) return res.status(404).json({ success: false, message: 'District not found.' });

    const [[metrics]] = await db.query(`
      SELECT COUNT(*) AS total_cases,
             SUM(status NOT IN ${terminalStatuses}) AS open_cases,
             SUM(status IN ${terminalStatuses}) AS closed_cases,
             SUM(status NOT IN ${terminalStatuses} AND created_at < DATE_SUB(NOW(), INTERVAL 14 DAY)) AS overdue_cases,
             SUM(assigned_officer_id IS NULL AND status NOT IN ${terminalStatuses}) AS unassigned_cases,
             SUM(status IN ('pending_commander_review','PENDING_COMMANDER_REVIEW')) AS pending_review
        FROM cases WHERE district_id = ?`, [id]);
    const [[obSummary]] = await db.query(`SELECT COUNT(*) AS total,
      SUM(DATE(created_at) = CURDATE()) AS today FROM ob_entries WHERE district_id = ?`, [id]);
    const [[custody]] = await db.query(`
      SELECT COUNT(*) AS arrests,
             SUM(a.sentence_status = 'released') AS released,
             SUM(a.sentence_status IN ('wanted','escaped')) AS wanted
        FROM arrests a JOIN cases c ON c.id = a.case_id WHERE c.district_id = ?`, [id]);
    const [[stationJail]] = await db.query(`
      SELECT COUNT(*) AS total
        FROM prison_admissions pa
        JOIN arrests a ON a.id = pa.arrest_id
        JOIN cases c ON c.id = a.case_id
       WHERE c.district_id = ? AND pa.status = 'admitted'`, [id]);
    const [[districtUsers]] = await db.query(`
      SELECT COUNT(*) AS total FROM users WHERE district_id = ? AND is_active = 1`, [id]);

    const [pendingCases] = await db.query(`
      SELECT c.id, c.case_number, c.ob_number, c.title, c.priority,
             c.status, c.created_at, c.assigned_officer_id, po.full_name AS assigned_officer
        FROM cases c LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
       WHERE c.district_id = ? AND c.status IN ('pending_commander_review','PENDING_COMMANDER_REVIEW')
       ORDER BY c.created_at ASC`, [id]);
    const [activeCases] = await db.query(`
      SELECT c.id, c.case_number, c.ob_number, c.title, c.priority, c.status, c.created_at,
             c.assigned_officer_id, po.full_name AS assigned_officer
        FROM cases c LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
       WHERE c.district_id = ? AND c.status NOT IN ${terminalStatuses}
       ORDER BY (c.assigned_officer_id IS NULL) DESC, c.created_at ASC LIMIT 100`, [id]);

    const [investigatorTasks] = await db.query(`
      SELECT rf.id, rf.case_id, c.case_number, c.ob_number,
             COALESCE(c.title, c.case_title) AS title, rf.reason, rf.status,
             rf.referred_by, rf.referred_at, po.full_name AS assigned_investigator
        FROM referrals rf
        JOIN cases c ON c.id = rf.case_id
        LEFT JOIN police_officers po ON po.id = c.assigned_officer_id
       WHERE c.district_id = ? AND LOWER(rf.referred_to_role) = 'investigator'
       ORDER BY FIELD(rf.status,'pending','accepted','in_progress','completed','rejected'), rf.referred_at DESC
       LIMIT 100`, [id]);

    const [officers] = await db.query(`
      SELECT po.id, po.full_name, po.force_number, r.rank_name,
             COUNT(DISTINCT c.id) AS total_cases,
             SUM(c.status NOT IN ${terminalStatuses}) AS open_cases,
             SUM(c.status IN ${terminalStatuses}) AS closed_cases,
             SUM(c.status NOT IN ${terminalStatuses} AND c.created_at < DATE_SUB(NOW(), INTERVAL 14 DAY)) AS overdue_cases,
             CASE WHEN COUNT(DISTINCT c.id) = 0 THEN 0 ELSE ROUND(100 * SUM(c.status IN ${terminalStatuses}) / COUNT(DISTINCT c.id)) END AS clearance_rate
        FROM officer_assignments oa
        JOIN police_officers po ON po.id = oa.officer_id
        LEFT JOIN ranks r ON r.id = po.rank_id
        LEFT JOIN cases c ON c.assigned_officer_id = po.id AND c.district_id = ?
       WHERE LOWER(oa.assignment_type) IN ('district','district station') AND oa.assignment_id = ? AND oa.is_current = 1
       GROUP BY po.id ORDER BY open_cases DESC, po.full_name`, [id, id]);

    const [attendance] = await db.query(`
      SELECT oa2.id, oa2.officer_id, po.full_name, po.force_number, oa2.attendance_date, oa2.shift, oa2.status, oa2.notes
        FROM officer_attendance oa2 JOIN police_officers po ON po.id = oa2.officer_id
       WHERE oa2.district_id = ? AND oa2.attendance_date = CURDATE()
       ORDER BY oa2.shift, po.full_name`, [id]);

    const [recentActivities] = await db.query(`
      SELECT ca.id, ca.case_id, ca.action_type, ca.description, ca.performed_by, ca.created_at, c.case_number
        FROM case_actions ca JOIN cases c ON c.id = ca.case_id
       WHERE c.district_id = ? ORDER BY ca.created_at DESC LIMIT 25`, [id]);

    const [evidenceIssues] = await db.query(`
      SELECT e.id, e.evidence_number, e.title, c.case_number
        FROM evidence e JOIN cases c ON c.id = e.case_id
       WHERE c.district_id = ? AND e.created_at < DATE_SUB(NOW(), INTERVAL 1 DAY)
         AND NOT EXISTS (SELECT 1 FROM chain_of_custody coc WHERE coc.evidence_id = e.id)
       LIMIT 20`, [id]);
    const [wantedPeople] = await db.query(`
      SELECT a.id, s.full_name, a.sentence_status, c.case_number
        FROM arrests a JOIN criminals s ON s.id = a.suspect_id JOIN cases c ON c.id = a.case_id
       WHERE c.district_id = ? AND a.sentence_status IN ('wanted','escaped') LIMIT 20`, [id]);
    const [hotspots] = await db.query(`
      SELECT incident_location AS location, COUNT(*) AS total,
             SUM(priority IN ('high','critical')) AS serious,
             GROUP_CONCAT(DISTINCT COALESCE(case_type, incident_type) ORDER BY COALESCE(case_type, incident_type) SEPARATOR ', ') AS categories
        FROM cases WHERE district_id = ? AND incident_location IS NOT NULL AND incident_location <> ''
       GROUP BY incident_location ORDER BY total DESC, serious DESC LIMIT 20`, [id]);
    const [complaints] = await db.query(`
      SELECT dc.*, po.full_name AS assigned_officer,
             (dc.response_deadline < NOW() AND dc.status NOT IN ('resolved','closed')) AS overdue
        FROM district_complaints dc LEFT JOIN police_officers po ON po.id = dc.assigned_officer_id
       WHERE dc.district_id = ? ORDER BY FIELD(dc.status,'new','escalated','assigned','in_progress','resolved','closed'), dc.created_at DESC`, [id]);

    res.json({ success: true, data: {
      district,
      metrics: { ...metrics, total_ob: obSummary.total, ob_today: obSummary.today,
        total_officers: officers.length, station_prisoners: stationJail.total,
        investigator_tasks: investigatorTasks.length, district_users: districtUsers.total,
        arrests: custody.arrests, released: custody.released, wanted: custody.wanted },
      pendingCases, activeCases, investigatorTasks, officers, attendance, recentActivities, hotspots, complaints,
      alerts: {
        evidenceIssues, wantedPeople,
        highWorkload: officers.filter((officer) => Number(officer.open_cases) >= 5),
      },
    } });
  } catch (err) { next(err); }
};

const createComplaint = async (req, res, next) => {
  try {
    const id = districtId(req);
    const { complainant_name, phone, category, subject, description, location, priority, assigned_officer_id, response_deadline } = req.body;
    if (!id || !complainant_name || !category || !subject || !description) {
      return res.status(400).json({ success: false, message: 'Complainant, category, subject, and description are required.' });
    }
    const reference = `CMP-${new Date().getFullYear()}-${id}-${Date.now().toString().slice(-7)}`;
    const status = assigned_officer_id ? 'assigned' : 'new';
    const [result] = await db.query(`INSERT INTO district_complaints
      (reference_number,district_id,complainant_name,phone,category,subject,description,location,priority,status,assigned_officer_id,response_deadline,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [reference,id,complainant_name,phone||null,category,subject,description,location||null,priority||'medium',status,assigned_officer_id||null,response_deadline||null,req.user.username]);
    await writeAuditLog({ userId:req.user.username,userEmail:req.user.email,action:'CREATE_DISTRICT_COMPLAINT',entityType:'district_complaints',entityId:result.insertId,newData:{ reference } });
    res.status(201).json({ success:true,message:'Complaint registered successfully.',data:{ id:result.insertId,reference_number:reference } });
  } catch (err) { next(err); }
};

const updateComplaint = async (req, res, next) => {
  try {
    const id = districtId(req);
    const complaintId = Number(req.params.id);
    const [[existing]] = await db.query('SELECT * FROM district_complaints WHERE id = ? AND district_id = ?', [complaintId,id]);
    if (!existing) return res.status(404).json({ success:false,message:'Complaint not found.' });
    const { status, priority, assigned_officer_id, response_deadline, resolution_notes } = req.body;
    const allowed = ['new','assigned','in_progress','resolved','closed','escalated'];
    if (status && !allowed.includes(status)) return res.status(400).json({ success:false,message:'Invalid complaint status.' });
    await db.query(`UPDATE district_complaints SET status=?, priority=?, assigned_officer_id=?, response_deadline=?, resolution_notes=? WHERE id=?`, [status||existing.status,priority||existing.priority,assigned_officer_id||existing.assigned_officer_id,response_deadline||existing.response_deadline,resolution_notes ?? existing.resolution_notes,complaintId]);
    await writeAuditLog({ userId:req.user.username,userEmail:req.user.email,action:'UPDATE_DISTRICT_COMPLAINT',entityType:'district_complaints',entityId:complaintId,newData:req.body });
    res.json({ success:true,message:'Complaint updated successfully.' });
  } catch (err) { next(err); }
};

const saveAttendance = async (req, res, next) => {
  try {
    const id = districtId(req);
    const { attendance_date, shift, entries } = req.body;
    if (!id || !attendance_date || !['morning','afternoon','night'].includes(shift) || !Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ success: false, message: 'district, attendance_date, shift, and entries are required.' });
    }
    const allowed = new Set(['present','absent','leave','patrol']);
    const connection = await db.pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const entry of entries) {
        if (!entry.officer_id || !allowed.has(entry.status)) throw Object.assign(new Error('Invalid attendance entry.'), { status: 400 });
        await connection.query(`
          INSERT INTO officer_attendance (officer_id,district_id,attendance_date,shift,status,notes,recorded_by)
          VALUES (?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),notes=VALUES(notes),recorded_by=VALUES(recorded_by),updated_at=NOW()`,
          [entry.officer_id,id,attendance_date,shift,entry.status,entry.notes || null,req.user.username]
        );
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
    await writeAuditLog({ userId: req.user.username, userEmail: req.user.email, action: 'DISTRICT_ATTENDANCE', entityType: 'officer_attendance', entityId: id, newData: { attendance_date, shift, count: entries.length } });
    res.json({ success: true, message: `Attendance saved for ${entries.length} officers.` });
  } catch (err) { next(err); }
};

module.exports = { getDistrictOperations, saveAttendance, createComplaint, updateComplaint };
