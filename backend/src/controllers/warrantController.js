'use strict';

const path = require('path');
const db = require('../config/database');
const { getUserLocation, normalizeRole } = require('../utils/locationScope');
const { validateWarrantDates, today } = require('../utils/dateValidation');
const { writeAuditLog } = require('../utils/auditLogger');

const TYPES = ['arrest','search','court_summons','detention','other_court_order'];
const STATUSES = ['draft','pending','issued','executed','expired','cancelled'];
const privileged = (req) => ['admin','court','court_admin'].includes(normalizeRole(req.user.role));
const meta = (req) => ({ userId: req.user.id, userEmail: req.user.email, ipAddress: req.ip, userAgent: req.get('user-agent') });

async function stationIdFor(req, requested) {
  if (privileged(req)) return Number(requested) || null;
  const location = await getUserLocation(req.user);
  if (!location.district_id) {
    const error = new Error('Commander and station users must be assigned to one police station.');
    error.statusCode = 403; throw error;
  }
  if (requested && Number(requested) !== Number(location.district_id)) {
    const error = new Error('You are not authorized to access records from another police station.');
    error.statusCode = 403; throw error;
  }
  return Number(location.district_id);
}

async function expireWarrants() {
  await db.query("UPDATE warrants SET status='expired' WHERE status IN ('pending','issued') AND expiry_date < CURDATE()");
}

const list = async (req, res, next) => {
  try {
    await expireWarrants();
    const { status, type, station_id, case_number, suspect, from_date, to_date, page = 1, limit = 20 } = req.query;
    const params = []; let where = '1=1';
    const station = await stationIdFor(req, station_id);
    if (station) { where += ' AND w.police_station_id=?'; params.push(station); }
    if (status) { where += ' AND w.status=?'; params.push(status); }
    if (type) { where += ' AND w.warrant_type=?'; params.push(type); }
    if (case_number) { where += ' AND (c.case_number LIKE ? OR ob.ob_number LIKE ?)'; params.push(`%${case_number}%`, `%${case_number}%`); }
    if (suspect) { where += ' AND (w.subject_name LIKE ? OR cr.full_name LIKE ?)'; params.push(`%${suspect}%`, `%${suspect}%`); }
    if (from_date) { where += ' AND w.issue_date>=?'; params.push(from_date); }
    if (to_date) { where += ' AND w.issue_date<=?'; params.push(to_date); }
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20)); const offset = (Math.max(1, Number(page) || 1) - 1) * safeLimit;
    const joins = ` FROM warrants w LEFT JOIN cases c ON c.id=w.case_id LEFT JOIN ob_entries ob ON ob.id=w.ob_entry_id LEFT JOIN criminals cr ON cr.id=w.criminal_id LEFT JOIN legal_personnel j ON j.id=w.issued_by_judge_id LEFT JOIN districts d ON d.id=w.police_station_id`;
    const [[count]] = await db.query(`SELECT COUNT(*) total ${joins} WHERE ${where}`, params);
    const [rows] = await db.query(`SELECT w.*,c.case_number,ob.ob_number,COALESCE(cr.full_name,w.subject_name) suspect_name,j.full_name judge_name,d.district_name police_station ${joins} WHERE ${where} ORDER BY w.created_at DESC LIMIT ? OFFSET ?`, [...params, safeLimit, offset]);
    res.json({ success: true, data: rows, pagination: { page: Number(page), limit: safeLimit, total: count.total } });
  } catch (error) { next(error); }
};

const getOne = async (req, res, next) => {
  try {
    await expireWarrants();
    const station = await stationIdFor(req, null);
    const params = [req.params.id]; let scope = '';
    if (station) { scope = ' AND w.police_station_id=?'; params.push(station); }
    const [[row]] = await db.query(`SELECT w.*,c.case_number,ob.ob_number,COALESCE(cr.full_name,w.subject_name) suspect_name,j.full_name judge_name,p.full_name prosecutor_name,d.district_name police_station FROM warrants w LEFT JOIN cases c ON c.id=w.case_id LEFT JOIN ob_entries ob ON ob.id=w.ob_entry_id LEFT JOIN criminals cr ON cr.id=w.criminal_id LEFT JOIN legal_personnel j ON j.id=w.issued_by_judge_id LEFT JOIN legal_personnel p ON p.id=w.requested_by_prosecutor_id LEFT JOIN districts d ON d.id=w.police_station_id WHERE w.id=?${scope}`, params);
    if (!row) return res.status(404).json({ success: false, message: 'Warrant not found or outside your police station.' });
    res.json({ success: true, data: row });
  } catch (error) { next(error); }
};

async function validateReferences(data, station) {
  if (!data.case_id && !data.ob_entry_id) return 'A warrant must be linked to a case or OB entry.';
  if (data.case_id) {
    const [[record]] = await db.query('SELECT district_id FROM cases WHERE id=?', [data.case_id]);
    if (!record) return 'The selected case does not exist.';
    if (station && Number(record.district_id) !== Number(station)) return 'You are not authorized to access records from another police station.';
  }
  if (data.ob_entry_id) {
    const [[record]] = await db.query('SELECT district_id FROM ob_entries WHERE id=?', [data.ob_entry_id]);
    if (!record) return 'The selected OB entry does not exist.';
    if (station && Number(record.district_id) !== Number(station)) return 'You are not authorized to access records from another police station.';
  }
  if (data.issued_by_judge_id) {
    const [[judge]] = await db.query("SELECT id FROM legal_personnel WHERE id=? AND personnel_type='judge' AND status='active'", [data.issued_by_judge_id]);
    if (!judge) return 'Issued By Judge must be selected from the active judges list.';
  }
  return null;
}

const create = async (req, res, next) => {
  try {
    const data = req.body; const station = await stationIdFor(req, data.police_station_id);
    if (!station) return res.status(400).json({ success: false, message: 'Police station is required.' });
    if (!data.warrant_number || !TYPES.includes(data.warrant_type) || !data.subject_name || !data.reason) return res.status(400).json({ success: false, message: 'Warrant number, type, subject, and reason are required.' });
    const dateError = validateWarrantDates({ issueDate: data.issue_date, expiryDate: data.expiry_date });
    if (dateError) return res.status(400).json({ success: false, message: dateError });
    const refError = await validateReferences(data, station); if (refError) return res.status(400).json({ success: false, message: refError });
    if (data.status && !['draft','pending','issued'].includes(data.status)) return res.status(400).json({ success: false, message: 'A new warrant can only be Draft, Pending, or Issued.' });
    const attachment = req.file ? `/uploads/warrants/${req.file.filename}` : null;
    const [result] = await db.query(`INSERT INTO warrants (warrant_number,warrant_type,case_id,ob_entry_id,criminal_id,subject_name,reason,issued_by_judge_id,requested_by_prosecutor_id,requested_by_officer_id,police_station_id,issue_date,expiry_date,status,attachment_url,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [data.warrant_number,data.warrant_type,data.case_id||null,data.ob_entry_id||null,data.criminal_id||null,data.subject_name,data.reason,data.issued_by_judge_id||null,data.requested_by_prosecutor_id||null,data.requested_by_officer_id||null,station,data.issue_date,data.expiry_date,data.status||'draft',attachment,req.user.id]);
    const [[created]] = await db.query('SELECT * FROM warrants WHERE id=?',[result.insertId]);
    await writeAuditLog({ ...meta(req), policeStationId: station, action: created.status === 'issued' ? 'ISSUE_WARRANT' : 'CREATE_WARRANT', entityType: 'warrants', entityId: result.insertId, newData: created });
    res.status(201).json({ success: true, data: created });
  } catch (error) { next(error); }
};

const update = async (req,res,next) => {
  try {
    const station=await stationIdFor(req,req.body.police_station_id);
    const params=[req.params.id];let scope='';if(station){scope=' AND police_station_id=?';params.push(station);}
    const [[oldData]]=await db.query(`SELECT * FROM warrants WHERE id=?${scope}`,params);
    if(!oldData)return res.status(404).json({success:false,message:'Warrant not found or outside your police station.'});
    if(['executed','cancelled','expired'].includes(oldData.status))return res.status(409).json({success:false,message:'Executed, cancelled, or expired warrants cannot be edited.'});
    const data={...oldData,...req.body};
    if(req.body.warrant_type&&!TYPES.includes(req.body.warrant_type))return res.status(400).json({success:false,message:'Invalid warrant type.'});
    if(req.body.status&&!['draft','pending','issued'].includes(req.body.status))return res.status(400).json({success:false,message:'Invalid warrant status transition.'});
    const dateError=validateWarrantDates({issueDate:String(data.issue_date).slice(0,10),expiryDate:String(data.expiry_date).slice(0,10)});
    if(dateError)return res.status(400).json({success:false,message:dateError});
    const refError=await validateReferences(data,station);if(refError)return res.status(400).json({success:false,message:refError});
    const allowed=['warrant_type','case_id','ob_entry_id','criminal_id','subject_name','reason','issued_by_judge_id','requested_by_prosecutor_id','requested_by_officer_id','issue_date','expiry_date','status'];
    const keys=allowed.filter(key=>req.body[key]!==undefined);if(!keys.length)return res.status(400).json({success:false,message:'No update fields provided.'});
    await db.query(`UPDATE warrants SET ${keys.map(key=>`${key}=?`).join(',')} WHERE id=?`,[...keys.map(key=>req.body[key]||null),oldData.id]);
    const [[newData]]=await db.query('SELECT * FROM warrants WHERE id=?',[oldData.id]);
    await writeAuditLog({...meta(req),policeStationId:oldData.police_station_id,action:oldData.status!=='issued'&&newData.status==='issued'?'ISSUE_WARRANT':'UPDATE_WARRANT',entityType:'warrants',entityId:oldData.id,oldData,newData});
    res.json({success:true,data:newData});
  }catch(error){next(error);}
};

const updateStatus = async (req, res, next) => {
  try {
    const station = await stationIdFor(req, null);
    const params = [req.params.id]; let scope = ''; if (station) { scope=' AND police_station_id=?'; params.push(station); }
    const [[oldData]] = await db.query(`SELECT * FROM warrants WHERE id=?${scope}`, params);
    if (!oldData) return res.status(404).json({ success:false,message:'Warrant not found or outside your police station.' });
    const action = req.params.action; let nextStatus; const updates=[]; const values=[];
    if (action === 'cancel') {
      if (oldData.status === 'executed') return res.status(409).json({ success:false,message:'Executed warrant cannot be cancelled.' });
      if (!req.body.reason) return res.status(400).json({ success:false,message:'Cancellation reason is required.' });
      nextStatus='cancelled'; updates.push('cancellation_reason=?','cancelled_at=NOW()'); values.push(req.body.reason);
    } else if (action === 'execute') {
      if (oldData.status === 'cancelled') return res.status(409).json({ success:false,message:'Cancelled warrant cannot be marked as executed.' });
      if (!['issued','pending'].includes(oldData.status)) return res.status(409).json({ success:false,message:'Only an issued or pending warrant can be executed.' });
      const executionDate=req.body.execution_date||today();
      const error=validateWarrantDates({issueDate:String(oldData.issue_date).slice(0,10),expiryDate:String(oldData.expiry_date).slice(0,10),executionDate});
      if(error)return res.status(400).json({success:false,message:error});
      nextStatus='executed';updates.push('execution_date=?','execution_notes=?');values.push(executionDate,req.body.execution_notes||null);
    } else return res.status(400).json({success:false,message:'Unsupported warrant action.'});
    updates.unshift('status=?');values.unshift(nextStatus);values.push(oldData.id);
    await db.query(`UPDATE warrants SET ${updates.join(',')} WHERE id=?`,values);
    const [[newData]]=await db.query('SELECT * FROM warrants WHERE id=?',[oldData.id]);
    await writeAuditLog({...meta(req),policeStationId:oldData.police_station_id,action:nextStatus==='cancelled'?'CANCEL_WARRANT':'EXECUTE_WARRANT',entityType:'warrants',entityId:oldData.id,oldData,newData});
    res.json({success:true,data:newData});
  } catch(error){next(error);}
};

const document = async (req,res,next) => {
  try {
    const station=await stationIdFor(req,null);const params=[req.params.id];let scope='';if(station){scope=' AND w.police_station_id=?';params.push(station);}
    const [[w]]=await db.query(`SELECT w.*,d.district_name,j.full_name judge_name FROM warrants w JOIN districts d ON d.id=w.police_station_id LEFT JOIN legal_personnel j ON j.id=w.issued_by_judge_id WHERE w.id=?${scope}`,params);
    if(!w)return res.status(404).json({success:false,message:'Warrant not found.'});
    res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><title>${w.warrant_number}</title><style>body{font-family:Arial;max-width:800px;margin:40px auto;line-height:1.6}h1{text-align:center}dl{display:grid;grid-template-columns:180px 1fr}dt{font-weight:bold}</style></head><body><h1>POLICE WARRANT</h1><dl><dt>Warrant Number</dt><dd>${w.warrant_number}</dd><dt>Type</dt><dd>${w.warrant_type}</dd><dt>Subject</dt><dd>${w.subject_name}</dd><dt>Reason</dt><dd>${w.reason}</dd><dt>Judge</dt><dd>${w.judge_name||'Pending assignment'}</dd><dt>Station</dt><dd>${w.district_name}</dd><dt>Issue / Expiry</dt><dd>${String(w.issue_date).slice(0,10)} / ${String(w.expiry_date).slice(0,10)}</dd><dt>Status</dt><dd>${w.status}</dd></dl><script>window.print()</script></body></html>`);
  } catch(error){next(error);}
};

module.exports={list,getOne,create,update,updateStatus,document};
