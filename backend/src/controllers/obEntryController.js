'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { generateOBNumber } = require('../utils/obNumberGenerator');
const { generateCaseNumber } = require('../utils/caseNumberGenerator');
const { buildScopeWhere, getUserLocation, normalizeRole } = require('../utils/locationScope');
const { validateObDates } = require('../utils/dateValidation');

const OB_EDITABLE_STATUSES = new Set(['DRAFT', 'REGISTERED', 'OB_REGISTERED', 'PRELIMINARY_REVIEW']);
const OB_TRANSITIONS = {
  DRAFT: ['REGISTERED'], REGISTERED: ['PRELIMINARY_REVIEW'], OB_REGISTERED: ['PRELIMINARY_REVIEW'],
  PRELIMINARY_REVIEW: ['INVESTIGATION_TRACING'], INVESTIGATION_TRACING: ['ARRESTED_IN_CUSTODY', 'SENT_TO_CID_OR_COURT'],
  ARRESTED_IN_CUSTODY: ['INVESTIGATION_TRACING', 'SENT_TO_CID_OR_COURT'], SENT_TO_CID_OR_COURT: ['CLOSED'], CLOSED: [],
};
const parseList = (value, field) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch (_) {}
  const error = new Error(`${field} must be a valid array.`); error.status = 400; throw error;
};
const formatDateForDb = (value) => {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  const dateObj = new Date(str);
  if (isNaN(dateObj.getTime())) return str.slice(0, 19).replace('T', ' ');
  return dateObj.toISOString().slice(0, 19).replace('T', ' ');
};
const validPhone = value => !value || /^\+?[0-9][0-9\s-]{6,19}$/.test(String(value));
const OB_SUPERVISOR_ROLES = new Set(['admin','district_admin','state_commander','region_commander','district_commander','police_station_commander']);
const audit = (req, action, entityType, entityId, oldData, newData) => writeAuditLog({
  userId: req.user.username, userEmail: req.user.email || req.user.username, action, entityType, entityId,
  oldData, newData, ipAddress: req.ip, userAgent: req.headers['user-agent'], policeStationId: req.user.location?.districtId || null,
});

const RESOLUTION_TYPES = {
  reconciliation: { title:'Heshiiska Dib-u-Heshiisiinta', status:'RESOLVED_BY_RECONCILIATION', required:['agreement_terms','witnesses'] },
  warning: { title:'Warqad Digniin', status:'WARNING_ISSUED', required:['warning_reason'] },
  mediation: { title:'Warqad Dhexdhexaadin iyo Heshiisiin', status:'MEDIATION_COMPLETED', required:['mediator_name','disputed_issues'] },
  withdrawal: { title:'Warqad Ka-Noqoshada Cabashada', status:'COMPLAINT_WITHDRAWN', required:['withdrawal_reason'] },
  false_report: { title:'Warqad Caddeyn Warbixin Qaldan', status:'FALSE_REPORT_CORRECTED', required:['incorrect_information','corrected_information'] },
  general_agreement: { title:'Heshiis Guud', status:'GENERAL_AGREEMENT_COMPLETED', required:['agreement_terms','witness_1','witness_2'] },
};
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,char=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[char]));
const documentHtml = (ob,type,data,user) => {
  const meta=RESOLUTION_TYPES[type];
  const first=`Magaca: <b>${escapeHtml(ob.reported_by)}</b><br>Aqoonsi: <b>${escapeHtml(ob.reporter_id_number||'N/A')}</b><br>Taleefan: <b>${escapeHtml(ob.reporter_phone||'N/A')}</b>`;
  const second=`Magaca: <b>${escapeHtml(ob.respondent_name||'N/A')}</b><br>Aqoonsi: <b>${escapeHtml(ob.respondent_id_number||'N/A')}</b><br>Taleefan: <b>${escapeHtml(ob.respondent_phone||'N/A')}</b>`;
  const blank=label=>`<div class="sig">${label}: ______________________________</div>`;
  let content='';
  if(type==='reconciliation') content=`<p>Waxaa heshiis galay:</p><h3>Dhinaca Koowaad:</h3><p>${first}</p><h3>Dhinaca Labaad:</h3><p>${second}</p><p>Labada dhinac waxay caddeynayaan in uu dhex maray khilaaf sababay cabasho/dacwad, kadibna ay ku heshiiyeen:</p><p class="box">${escapeHtml(data.agreement_terms).replaceAll('\n','<br>')}</p>${blank('Saxiixa Dhinaca Koowaad')}${blank('Saxiixa Dhinaca Labaad')}<p>Markhaati: <b>${escapeHtml(data.witnesses)}</b> &nbsp; Saxiix: __________________</p>`;
  if(type==='warning') content=`<p>Ku socota: <b>${escapeHtml(ob.respondent_name||'N/A')}</b></p><p>Waxaan kuu soo dirayaa warqaddan digniinta ah kadib arrin la xiriirta:</p><p class="box">${escapeHtml(data.warning_reason).replaceAll('\n','<br>')}</p><p>Magaca Qofka Digniinta Bixinaya: <b>${escapeHtml(user.fullName||user.username)}</b></p>${blank('Saxiix')}`;
  if(type==='mediation') content=`<p>Waxaa la qabtay kulan dhexdhexaadin ah oo u dhexeeya:</p><p>Qofka 1aad: <b>${escapeHtml(ob.reported_by)}</b></p><p>Qofka 2aad: <b>${escapeHtml(ob.respondent_name||'N/A')}</b></p><h3>Arrinta la isku hayay:</h3><p class="box">${escapeHtml(data.disputed_issues)}</p><p>Kadib wada-hadal, labada dhinac waxay ku heshiiyeen:</p><ol><li>In khilaafka lagu soo afjaro nabad.</li><li>In labada dhinac ixtiraamaan xuquuqda midba midka kale.</li><li>In aan dib loo soo celin muranka.</li></ol><p>Dhexdhexaadiye: <b>${escapeHtml(data.mediator_name)}</b></p>${blank('Saxiixa Dhexdhexaadiyaha')}${blank('Saxiixa Dhinaca Koowaad')}${blank('Saxiixa Dhinaca Labaad')}`;
  if(type==='withdrawal') content=`<p>Ku socota: <b>${escapeHtml(ob.district_police_station_name||'Saldhigga Booliiska')}</b></p><p>Aniga oo ah:</p><p>Magaca: <b>${escapeHtml(ob.reported_by)}</b><br>Aqoonsi: <b>${escapeHtml(ob.reporter_id_number||'N/A')}</b><br>Taleefan: <b>${escapeHtml(ob.reporter_phone||'N/A')}</b></p><p>Waxaan caddeynayaa inaan horay uga gudbiyay cabasho:</p><p>Magaca qofka laga cabtay: <b>${escapeHtml(ob.respondent_name||'N/A')}</b></p><p>Arrinta: <b>${escapeHtml(data.withdrawal_reason)}</b></p><p>Kadib heshiis iyo wada-hadal, waxaan go'aansaday inaan ka noqdo cabashadii aan gudbiyay.</p><p>Go'aankan waxaan ku gaaray rabitaankayga anigoon cadaadis lagu saarin.</p><p>Magaca: <b>${escapeHtml(ob.reported_by)}</b></p>${blank('Saxiix')}`;
  if(type==='false_report') content=`<p>Waxaan caddeynayaa in warbixintii hore ee ku saabsanayd:</p><p class="box">${escapeHtml(data.incorrect_information)}</p><p>ay ahayd warbixin aan sax ahayn oo aan si buuxda uga tarjumayn xaqiiqada.</p><h3>Xogta saxda ah waa:</h3><p class="box">${escapeHtml(data.corrected_information)}</p><p>Waxaan codsanayaa in la saxo diiwaanka arrintan.</p><p>Magaca: <b>${escapeHtml(ob.reported_by)}</b></p>${blank('Saxiix')}`;
  if(type==='general_agreement') content=`<p>Dhinaca Koowaad:</p><p>${first}</p><p>Dhinaca Labaad:</p><p>${second}</p><p class="box">${escapeHtml(data.agreement_terms).replaceAll('\n','<br>')}</p>${blank('Saxiixa Dhinaca Koowaad')}${blank('Saxiixa Dhinaca Labaad')}<p>Markhaati 1: <b>${escapeHtml(data.witness_1)}</b> &nbsp; Saxiix: ______________</p><p>Markhaati 2: <b>${escapeHtml(data.witness_2)}</b> &nbsp; Saxiix: ______________</p>${blank('Sarkaal/Guddi')}`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(meta.title)}</title><style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#111;line-height:1.65;font-size:14px}header{text-align:center;border-bottom:2px solid #111;margin-bottom:20px}h1{font-size:21px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:7px 22px}.box{border:1px solid #777;min-height:55px;padding:10px;white-space:pre-wrap}.sig{margin-top:34px}.footer{margin-top:38px;text-align:center;font-size:11px;color:#555}</style></head><body><header><h2>${escapeHtml(ob.district_police_station_name||ob.region_name||'Somali Police Force')}</h2><h1>${escapeHtml(meta.title)}</h1></header><div class="meta"><div><b>OB Number:</b> ${escapeHtml(ob.ob_number)}</div><div><b>Taariikh:</b> ${escapeHtml(ob.registration_date)}</div><div><b>Goobta:</b> ${escapeHtml(ob.incident_location)}</div><div><b>Xafiiska:</b> ${escapeHtml(ob.district_police_station_name||ob.region_name)}</div></div><hr>${content}<div class="footer">Waxaa diyaariyey: ${escapeHtml(user.fullName||user.username)} — ${new Date().toLocaleString('en-GB')}</div></body></html>`;
};

const getObEntries = async (req, res, next) => {
  try {
    const { status, registered_by_user_id, search, complaint_type, court_level, incident_date, arrest_status, district_id } = req.query;
    const scope = buildScopeWhere(req.user, 'ob');
    const params = [...scope.params];
    let whereClause = scope.clause;

    if (registered_by_user_id && normalizeRole(req.user.role) !== 'ob_staff') {
      whereClause += ' AND ob.registered_by_user_id = ?';
      params.push(registered_by_user_id);
    }
    if (status) {
      whereClause += ' AND ob.status = ?';
      params.push(status);
    }
    if (search) { whereClause += ' AND (ob.ob_number LIKE ? OR ob.case_title LIKE ? OR ob.reported_by LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
    if (complaint_type) { whereClause += ' AND ob.case_type = ?'; params.push(complaint_type); }
    if (court_level) { whereClause += ' AND ob.court_level = ?'; params.push(court_level); }
    if (incident_date) { whereClause += ' AND DATE(ob.incident_datetime) = ?'; params.push(incident_date); }
    if (district_id) { whereClause += ' AND ob.district_id = ?'; params.push(district_id); }
    if (arrest_status) { whereClause += ' AND EXISTS (SELECT 1 FROM ob_accused oa WHERE oa.ob_entry_id=ob.id AND oa.status=?)'; params.push(arrest_status); }
    whereClause += ' AND ob.deleted_at IS NULL';

    const [rows] = await db.query(
      `SELECT ob.*,
              sa.state_name,
              r.region_name,
              d.district_name AS district_police_station_name
       FROM ob_entries ob
       LEFT JOIN state_administrations sa ON ob.state_administration_id = sa.id
       LEFT JOIN regions r ON ob.region_id = r.id
       LEFT JOIN districts d ON ob.district_id = d.id
       WHERE ${whereClause}
       ORDER BY ob.created_at DESC`,
      params
    );

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getObEntryById = async (req, res, next) => {
  try {
    const scope = buildScopeWhere(req.user, 'ob');
    const params = [req.params.id, ...scope.params];
    const [[row]] = await db.query(
      `SELECT ob.*,
              sa.state_name,
              r.region_name,
              d.district_name AS district_police_station_name,
              c.id AS linked_case_id,
              c.case_number AS linked_case_number,
              c.status AS linked_case_status
       FROM ob_entries ob
       LEFT JOIN state_administrations sa ON ob.state_administration_id = sa.id
       LEFT JOIN regions r ON ob.region_id = r.id
       LEFT JOIN districts d ON ob.district_id = d.id
       LEFT JOIN cases c ON c.ob_entry_id = ob.id OR c.ob_number = ob.ob_number
       WHERE ob.id = ? AND ${scope.clause}`,
      params
    );

    if (!row) return res.status(404).json({ success: false, message: 'OB entry not found.' });
    const [attachments] = await db.query('SELECT * FROM ob_attachments WHERE ob_entry_id = ? ORDER BY created_at DESC', [req.params.id]);
    const [victims] = await db.query('SELECT * FROM ob_victims WHERE ob_entry_id = ? ORDER BY id', [req.params.id]);
    const [accused] = await db.query('SELECT * FROM ob_accused WHERE ob_entry_id = ? ORDER BY id', [req.params.id]);
    const [statusHistory] = await db.query('SELECT * FROM ob_status_history WHERE ob_entry_id = ? ORDER BY created_at, id', [req.params.id]);
    const [accusedStatusHistory] = await db.query('SELECT * FROM ob_accused_status_history WHERE ob_entry_id = ? ORDER BY created_at, id', [req.params.id]);
    const [resolutionDocuments] = await db.query('SELECT id,document_type,document_title,created_by,created_at FROM ob_resolution_documents WHERE ob_entry_id=? ORDER BY created_at DESC',[req.params.id]);
    res.json({ success: true, data: { ...row, attachments, victims, accused, statusHistory, accusedStatusHistory, resolutionDocuments } });
  } catch (err) { next(err); }
};

const resolveObEntry = async (req,res,next) => {
  try {
    const { resolution_method } = req.body;
    const config=RESOLUTION_TYPES[resolution_method];
    if(!config) return res.status(400).json({success:false,message:'A valid resolution document type is required.'});
    let documentData=req.body.document_data||{}; if(typeof documentData==='string'){try{documentData=JSON.parse(documentData)}catch{return res.status(400).json({success:false,message:'Resolution document data is invalid.'})}}
    const missing=config.required.filter(field=>!String(documentData[field]||'').trim());
    if(missing.length) return res.status(400).json({success:false,message:`Required document fields are missing: ${missing.join(', ')}`});
    const scope=buildScopeWhere(req.user,'ob');
    const [[ob]]=await db.query(`SELECT ob.* FROM ob_entries ob WHERE ob.id=? AND ${scope.clause}`,[req.params.id,...scope.params]);
    if(!ob) return res.status(404).json({success:false,message:'OB entry not found.'});
    if(ob.linked_case_id || ['CONVERTED_TO_CASE','CASE_OPENED'].includes(ob.status)) return res.status(409).json({success:false,message:'OB already converted to a case and cannot be resolved at OB level.'});
    if(ob.status==='CLOSED' || Object.values(RESOLUTION_TYPES).some(item=>item.status===ob.status)) {
      const [[existingDocument]]=await db.query('SELECT id,document_type,document_title FROM ob_resolution_documents WHERE ob_entry_id=? ORDER BY created_at DESC LIMIT 1',[ob.id]);
      if(existingDocument && existingDocument.document_type===resolution_method) {
        return res.json({success:true,message:'Official resolution document already exists and the OB is resolved.',documentId:existingDocument.id,status:ob.status,alreadyResolved:true});
      }
      return res.status(409).json({success:false,message:'OB entry is already resolved using another resolution type.'});
    }
    const [[fullOb]]=await db.query(`SELECT ob.*,d.district_name AS district_police_station_name,r.region_name FROM ob_entries ob LEFT JOIN districts d ON d.id=ob.district_id LEFT JOIN regions r ON r.id=ob.region_id WHERE ob.id=?`,[ob.id]);
    const html=documentHtml(fullOb,resolution_method,documentData,req.user);
    const connection=await db.pool.getConnection(); let doc;
    try {
      await connection.beginTransaction();
      await connection.query(`UPDATE ob_entries SET status=?,resolution_method=?,resolution_notes=?,resolution_parties=?,resolved_by=?,resolved_at=NOW() WHERE id=?`,[config.status,resolution_method,JSON.stringify(documentData),documentData.witnesses||documentData.mediator_name||null,req.user.username,ob.id]);
      [doc]=await connection.query(`INSERT INTO ob_resolution_documents(ob_entry_id,document_type,document_title,document_data,official_html,created_by) VALUES(?,?,?,?,?,?)`,[ob.id,resolution_method,config.title,JSON.stringify(documentData),html,req.user.username]);
      await connection.commit();
    } catch(error) { await connection.rollback(); throw error; } finally { connection.release(); }
    await writeAuditLog({
      userId:req.user.username,
      userEmail:req.user.email||req.user.username,
      action:'RESOLVE_OB_ENTRY',
      entityType:'ob_entries',
      entityId:ob.id,
      newData:{ resolution_method, status:config.status, document_id:doc.insertId, document_data:documentData },
    });
    res.json({success:true,message:'Official resolution document created and OB resolved.',documentId:doc.insertId,status:config.status});
  }catch(err){next(err)}
};

const getResolutionDocument=async(req,res,next)=>{try{const scope=buildScopeWhere(req.user,'ob');const [[doc]]=await db.query(`SELECT d.* FROM ob_resolution_documents d JOIN ob_entries ob ON ob.id=d.ob_entry_id WHERE d.id=? AND d.ob_entry_id=? AND ${scope.clause}`,[req.params.documentId,req.params.id,...scope.params]);if(!doc)return res.status(404).json({success:false,message:'Resolution document not found.'});res.json({success:true,data:doc});}catch(err){next(err)}};

const reopenObEntry = async (req,res,next) => {
  try {
    const { reason }=req.body; if(!reason || String(reason).trim().length<5) return res.status(400).json({success:false,message:'A reopen reason of at least 5 characters is required.'});
    const scope=buildScopeWhere(req.user,'ob'); const [[ob]]=await db.query(`SELECT ob.* FROM ob_entries ob WHERE ob.id=? AND ${scope.clause}`,[req.params.id,...scope.params]);
    if(!ob) return res.status(404).json({success:false,message:'OB entry not found.'});
    if(ob.status!=='CLOSED' && !Object.values(RESOLUTION_TYPES).some(item=>item.status===ob.status)) return res.status(409).json({success:false,message:'Only a resolved OB entry can be reopened.'});
    await db.query(`UPDATE ob_entries SET status='OB_REGISTERED',reopen_reason=?,reopened_by=?,reopened_at=NOW() WHERE id=?`,[reason,req.user.username,ob.id]);
    await writeAuditLog({userId:req.user.username,userEmail:req.user.email||req.user.username,action:'REOPEN_OB_ENTRY',entityType:'ob_entries',entityId:ob.id,newData:{reason}});
    res.json({success:true,message:'OB entry reopened successfully.'});
  }catch(err){next(err)}
};

const getDeployedOfficersForLocation = async (req, res, next) => {
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

    // Also check if current user matches a police officer directly
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

const createObEntry = async (req, res, next) => {
  let connection;
  try {
    const { incident_type, incident_location, description, reported_by, reporter_phone, reporter_gender, case_title, case_type, case_level,
      reporter_id_type, reporter_id_number, reporter_email, reporter_address, respondent_name, respondent_id_type,
      respondent_id_number, respondent_phone, respondent_email, respondent_address, incident_datetime, claim_value,
      registered_by_name, registered_by_rank, court_level } = req.body;
    const victims = parseList(req.body.victims, 'victims').filter(v => Object.values(v || {}).some(value => value !== undefined && value !== null && String(value).trim() !== ''));
    const accused = parseList(req.body.accused, 'accused').filter(a => Object.entries(a || {}).some(([key,value]) => !['custody_state','status'].includes(key) && value !== undefined && value !== null && String(value).trim() !== ''));
    if (!case_title || !case_type || !court_level || !incident_type || !incident_location || !incident_datetime || !description || !reported_by || !reporter_phone) {
      return res.status(400).json({ success: false, message: 'Complaint, incident, court, description, complainant name and phone fields are required.' });
    }
    if (!validPhone(reporter_phone) || victims.some(v => !validPhone(v.phone)) || accused.some(a => !validPhone(a.phone))) return res.status(400).json({ success:false, message:'One or more phone numbers are invalid.' });
    if (victims.some(v => !String(v.full_name || '').trim() || !String(v.details || '').trim())) return res.status(400).json({ success:false, message:'Every victim requires a full name and details.' });
    if (accused.some(a => a.custody_state === 'IN_CUSTODY' && !String(a.full_name || '').trim())) return res.status(400).json({ success:false, message:'An accused person in custody requires a full name.' });
    const duplicateKeys = accused.map((a,index) => `${String(a.full_name || 'unknown').trim().toLowerCase()}|${String(a.phone || a.id_number || a.identifying_information || index).trim().toLowerCase()}`);
    if (new Set(duplicateKeys).size !== duplicateKeys.length) return res.status(409).json({ success:false, message:'Duplicate accused persons are not allowed under the same OB.' });
    const dateError = validateObDates({ incidentDate: incident_datetime, registrationDate: new Date().toISOString().slice(0, 10) });
    if (dateError) return res.status(400).json({ success: false, message: dateError });
    if (claim_value !== undefined && claim_value !== '' && (!/^\d+(\.\d{1,2})?$/.test(String(claim_value)) || Number(claim_value) < 0)) {
      return res.status(400).json({ success: false, message: 'Amount must be a non-negative USD value with no more than two decimal places.' });
    }

    const location = await getUserLocation(req.user);
    if (normalizeRole(req.user.role) !== 'admin' && !location.state_administration_id && !location.region_id && !location.district_id) {
      return res.status(400).json({ success: false, message: 'Your account has no assigned administrative location.' });
    }

    const now = new Date();
    let obNumber = null;
    let result = null;
    let caseResult = null;
    let caseNumber = null;
    connection = await db.pool.getConnection();
    await connection.beginTransaction();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      obNumber = await generateOBNumber();
      try {
        [result] = await connection.query(
          `INSERT INTO ob_entries
            (ob_number, case_title, case_type, court_level, case_level, incident_type, incident_location, incident_datetime, claim_value,
             description, reported_by, reporter_phone, reporter_gender, reporter_id_type, reporter_id_number, reporter_email, reporter_address,
             respondent_name, respondent_id_type, respondent_id_number, respondent_phone, respondent_email, respondent_address,
             registered_by_user_id, registered_by_name, registered_by_role, registered_by_rank,
             state_administration_id, region_id, district_id,
             registration_date, registration_time, status, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'REGISTERED', ?)`,
          [
            obNumber, case_title, case_type, court_level, case_level || 'normal', incident_type, incident_location,
            formatDateForDb(incident_datetime), claim_value || null, description || null, reported_by, reporter_phone || null,
            reporter_gender || null, reporter_id_type || null, reporter_id_number || null, reporter_email || null, reporter_address || null,
            respondent_name || null, respondent_id_type || null, respondent_id_number || null, respondent_phone || null,
            respondent_email || null, respondent_address || null,
            req.user.id,
            registered_by_name || req.user.fullName || req.user.username,
            req.user.roleCode || req.user.role,
            registered_by_rank || req.user.rank || null,
            location.state_administration_id || null,
            location.region_id || null,
            location.district_id || null,
            now.toISOString().slice(0, 10),
            now.toTimeString().slice(0, 8),
            req.user.username,
          ]
        );
        break;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY' || attempt === 2) throw err;
      }
    }
    for (const victim of victims) await connection.query(
      'INSERT INTO ob_victims (ob_entry_id,full_name,phone,details,address,created_by) VALUES (?,?,?,?,?,?)',
      [result.insertId, victim.full_name.trim(), victim.phone || null, victim.details.trim(), victim.address || null, req.user.username]
    );
    for (const person of accused) {
      const inCustody = person.custody_state === 'IN_CUSTODY';
      if (inCustody && (!person.arrest_date || !person.arrest_location || !person.arresting_officer)) throw Object.assign(new Error('Arrest date, location and arresting officer are required for an accused person in custody.'), { status:400 });
      const status = inCustody ? 'ARRESTED' : (person.status === 'UNDER_TRACING' ? 'UNDER_TRACING' : 'WANTED');
      const [accusedResult] = await connection.query(
        `INSERT INTO ob_accused (ob_entry_id,full_name,phone,id_type,id_number,gender,address,description,identifying_information,custody_state,status,arrest_date,arrest_location,arresting_officer,tracing_sent_at,custody_ready,created_by,updated_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,${inCustody ? 'NULL' : 'NOW()'},?,?,?)`,
        [result.insertId, String(person.full_name || 'Lama aqoonsan').trim(), person.phone || null, person.id_type || null, person.id_number || null, person.gender || null,
          person.address || null, person.description || null, person.identifying_information || null, inCustody ? 'IN_CUSTODY' : 'NOT_IN_CUSTODY', status,
          inCustody ? formatDateForDb(person.arrest_date) : null, inCustody ? person.arrest_location : null, inCustody ? person.arresting_officer : null,
          inCustody ? 1 : 0, req.user.username, req.user.username]
      );
      await connection.query('INSERT INTO ob_accused_status_history (ob_entry_id,accused_id,previous_status,new_status,action,performed_by) VALUES (?,?,NULL,?,?,?)',
        [result.insertId, accusedResult.insertId, status, inCustody ? 'INITIAL_ARREST_REGISTERED' : 'SENT_FOR_TRACING', req.user.username]);
    }
    await connection.query('INSERT INTO ob_status_history (ob_entry_id,previous_status,new_status,reason,performed_by) VALUES (?,NULL,?,?,?)', [result.insertId,'REGISTERED','OB registered',req.user.username]);
    caseNumber = await generateCaseNumber();
    const [[districtLocation]] = await connection.query('SELECT city_id FROM districts WHERE id=?',[location.district_id || null]);
    [caseResult] = await connection.query(`INSERT INTO cases
      (case_number,case_title,title,case_type,case_level,ob_number,ob_entry_id,original_ob_staff_id,original_ob_staff_name,incident_type,incident_date,claim_value,description,incident_location,status,priority,state_administration_id,region_id,city_id,district_id,created_by,complainant_name,complainant_phone,complainant_id_type,complainant_id_number,complainant_address)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[
      caseNumber,case_title,case_title,case_type,case_level||'normal',obNumber,result.insertId,req.user.id,
      registered_by_name||req.user.fullName||req.user.username,incident_type,incident_datetime,claim_value||null,description,incident_location,
      'under_investigation','medium',location.state_administration_id||null,location.region_id||null,districtLocation?.city_id||null,location.district_id||null,
      req.user.username,reported_by,reporter_phone,reporter_id_type==='Aqoonsiga Qaranka'?'National ID':reporter_id_type==='Baasaboor'?'Passport':(['National ID','Passport'].includes(reporter_id_type)?reporter_id_type:null),reporter_id_number||null,reporter_address||null]);
    for(const victim of victims){
      const [vr]=await connection.query('INSERT INTO victims(full_name,phone,address,injury_description) VALUES(?,?,?,?)',[victim.full_name,victim.phone||null,victim.address||null,victim.details]);
      await connection.query('INSERT INTO case_victims(case_id,victim_id,notes,added_by) VALUES(?,?,?,?)',[caseResult.insertId,vr.insertId,'Waxaa laga soo wareejiyey OB-ga asalka ah.',req.user.username]);
    }
    const [obPeople]=await connection.query('SELECT * FROM ob_accused WHERE ob_entry_id=?',[result.insertId]);
    for(const person of obPeople){
      const [cr]=await connection.query(`INSERT INTO criminals(full_name,gender,id_type,id_number,phone,address,description,arrest_status,is_arrested) VALUES(?,?,?,?,?,?,?,?,?)`,[person.full_name,String(person.gender||'male').toLowerCase()==='female'?'female':'male',person.id_type,person.id_number,person.phone,person.address,[person.description,person.identifying_information].filter(Boolean).join('\n'),person.status==='ARRESTED'?'arrested':'wanted',person.status==='ARRESTED'?1:0]);
      await connection.query('INSERT INTO case_criminals(case_id,criminal_id,linked_by_user_id,role_in_case,notes,added_by) VALUES(?,?,?,?,?,?)',[caseResult.insertId,cr.insertId,req.user.username,'Eedaysane','Waxaa laga soo wareejiyey OB-ga asalka ah.',req.user.username]);
      if(person.status==='ARRESTED')await connection.query('INSERT INTO arrests(case_id,suspect_id,police_station_id,arrested_by,arrest_date,arrest_location,notes) VALUES(?,?,?,?,?,?,?)',[caseResult.insertId,cr.insertId,location.district_id||null,person.arresting_officer,person.arrest_date,person.arrest_location,'Waxaa lagu diiwaangeliyey OB-ga asalka ah.']);
    }
    await connection.query(`INSERT INTO referrals(case_id,referred_by,referred_to_role,reason,status) VALUES(?,?,'investigator','Si toos ah ayaa looga abuuray OB-ga','pending')`,[caseResult.insertId,req.user.username]);
    await connection.query(`INSERT INTO case_actions(case_id,performed_by,action_type,description,status_after) VALUES(?,?,'CASE_AUTO_CREATED_FROM_OB',?,'under_investigation')`,[caseResult.insertId,req.user.username,`Kiiska si toos ah ayaa looga abuuray ${obNumber}.`]);
    await connection.query("UPDATE ob_entries SET status='CONVERTED_TO_CASE' WHERE id=?",[result.insertId]);
    for (const file of req.files || []) {
      await connection.query('INSERT INTO ob_attachments (ob_entry_id,file_name,file_url,mime_type,file_size,uploaded_by) VALUES (?,?,?,?,?,?)', [result.insertId,file.originalname,`/uploads/ob/${file.filename}`,file.mimetype,file.size,req.user.username]);
    }
    await connection.commit();

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'CREATE_OB_ENTRY',
      entityType: 'ob_entries',
      entityId: result.insertId,
      newData: { obNumber, incident_type, incident_location, court_level, victimCount:victims.length, accusedCount:accused.length, location },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'OB-ga iyo kiiska si toos ah ayaa loo diiwaangeliyey.', obEntryId: result.insertId, obNumber, caseId:caseResult.insertId, caseNumber });
  } catch (err) { if (connection) await connection.rollback(); if (err.status) return res.status(err.status).json({success:false,message:err.message}); next(err); }
  finally { if (connection) connection.release(); }
};

const convertObToCase = async (req, res, next) => {
  let attemptedObNumber = null;
  try {
    const [[ob]] = await db.query(
      `SELECT ob.*, d.city_id
       FROM ob_entries ob
       LEFT JOIN districts d ON d.id = ob.district_id
       WHERE ob.id = ?`,
      [req.params.id]
    );
    if (!ob) return res.status(404).json({ success: false, message: 'OB entry not found.' });
    attemptedObNumber = ob.ob_number;
    const scope = buildScopeWhere(req.user, 'ob');
    if (scope.params.length) {
      const [[allowed]] = await db.query(`SELECT id FROM ob_entries ob WHERE ob.id = ? AND ${scope.clause}`, [ob.id, ...scope.params]);
      if (!allowed) return res.status(403).json({ success: false, message: 'You cannot convert an OB entry outside your location.' });
    }

    const [[existingCase]] = await db.query(
      `SELECT id, case_number
       FROM cases
       WHERE ob_entry_id = ? OR ob_number = ?
       ORDER BY id DESC
       LIMIT 1`,
      [ob.id, ob.ob_number]
    );
    if (existingCase) {
      if (!['CONVERTED_TO_CASE', 'CASE_OPENED'].includes(ob.status)) {
        await db.query('UPDATE ob_entries SET status = ? WHERE id = ?', ['CONVERTED_TO_CASE', ob.id]);
      }
      await db.query(
        `UPDATE cases
         SET ob_entry_id = COALESCE(ob_entry_id, ?),
             state_administration_id = COALESCE(?, state_administration_id),
             region_id = COALESCE(?, region_id),
             city_id = COALESCE(?, city_id),
             district_id = COALESCE(?, district_id),
             complainant_name = COALESCE(complainant_name, ?),
             complainant_phone = COALESCE(complainant_phone, ?),
             case_type = COALESCE(case_type, ?),
             incident_date = COALESCE(incident_date, ?),
             case_title = COALESCE(case_title, title, ?),
             title = COALESCE(title, case_title, ?)
         WHERE id = ?`,
        [
          ob.id,
          ob.state_administration_id || null,
          ob.region_id || null,
          ob.city_id || null,
          ob.district_id || null,
          ob.reported_by || null,
          ob.reporter_phone || null,
          ob.case_type || null,
          ob.incident_datetime || null,
          ob.case_title || ob.incident_type || null,
          ob.case_title || ob.incident_type || null,
          existingCase.id,
        ]
      );
      return res.status(200).json({
        success: true,
        message: 'This OB already has a linked case.',
        caseId: existingCase.id,
        caseNumber: existingCase.case_number,
        obNumber: ob.ob_number,
        alreadyExists: true,
      });
    }

    const { assigned_staff_id, priority, status } = req.body;
    const caseNumber = await generateCaseNumber();
    const caseStatus = status || 'under_investigation';
    const [result] = await db.query(
      `INSERT INTO cases
        (case_number, case_title, title, case_type, case_level, ob_number, ob_entry_id, original_ob_staff_id, original_ob_staff_name,
         incident_type, incident_date, claim_value, description, incident_location, status, priority, state_administration_id, region_id, city_id,
         district_id, assigned_officer_id, created_by, complainant_name, complainant_phone,
         complainant_id_type, complainant_id_number, complainant_email, complainant_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseNumber,
        ob.case_title || ob.incident_type || 'General',
        ob.case_title || ob.incident_type || 'General',
        ob.case_type || 'General',
        ob.case_level || 'normal',
        ob.ob_number,
        ob.id,
        ob.registered_by_user_id,
        ob.registered_by_name,
        ob.incident_type || 'General',
        ob.incident_datetime || ob.created_at || new Date(),
        ob.claim_value || null,
        ob.description,
        ob.incident_location,
        caseStatus,
        priority || 'medium',
        ob.state_administration_id,
        ob.region_id,
        ob.city_id || null,
        ob.district_id,
        assigned_staff_id || null,
        req.user.username,
        ob.reported_by || null,
        ob.reporter_phone || null,
        ob.reporter_id_type || null,
        ob.reporter_id_number || null,
        ob.reporter_email || null,
        ob.reporter_address || null,
      ]
    );

    const [obVictims] = await db.query('SELECT * FROM ob_victims WHERE ob_entry_id=?',[ob.id]);
    for (const victim of obVictims) {
      const [victimResult] = await db.query('INSERT INTO victims(full_name,phone,address,injury_description) VALUES(?,?,?,?)',[victim.full_name,victim.phone,victim.address,victim.details]);
      await db.query('INSERT INTO case_victims(case_id,victim_id,notes,added_by) VALUES(?,?,?,?)',[result.insertId,victimResult.insertId,'Transferred from original OB record.',req.user.username]);
    }
    const [obAccused] = await db.query('SELECT * FROM ob_accused WHERE ob_entry_id=?',[ob.id]);
    for (const person of obAccused) {
      const [criminalResult] = await db.query(`INSERT INTO criminals(full_name,gender,id_type,id_number,phone,address,description,arrest_status,is_arrested) VALUES(?,?,?,?,?,?,?,?,?)`,
        [person.full_name,String(person.gender||'male').toLowerCase()==='female'?'female':'male',person.id_type,person.id_number,person.phone,person.address,[person.description,person.identifying_information].filter(Boolean).join('\n'),person.status==='ARRESTED'?'arrested':'wanted',person.status==='ARRESTED'?1:0]);
      await db.query('INSERT INTO case_criminals(case_id,criminal_id,linked_by_user_id,role_in_case,notes,added_by) VALUES(?,?,?,?,?,?)',[result.insertId,criminalResult.insertId,req.user.username,'Accused','Transferred from original OB record.',req.user.username]);
      if(person.status==='ARRESTED') await db.query('INSERT INTO arrests(case_id,suspect_id,police_station_id,arrested_by,arrest_date,arrest_location,notes) VALUES(?,?,?,?,?,?,?)',[result.insertId,criminalResult.insertId,ob.district_id,person.arresting_officer,person.arrest_date,person.arrest_location,'Arrest registered under original OB.']);
    }

    // Keep newly opened OB cases in the investigator workflow.
    await db.query(
      `INSERT INTO referrals (case_id, referred_by, referred_to_role, reason, status)
       VALUES (?, ?, 'investigator', 'Case opened from OB for investigation', 'pending')`,
      [result.insertId, req.user.username]
    );

    await db.query('UPDATE ob_entries SET status = ? WHERE id = ?', ['CONVERTED_TO_CASE', ob.id]);
    await db.query('INSERT INTO ob_status_history(ob_entry_id,previous_status,new_status,reason,performed_by) VALUES(?,?,?,?,?)',[ob.id,ob.status,'CONVERTED_TO_CASE',`Formal case ${caseNumber} opened for investigation.`,req.user.username]);
    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
       VALUES (?, ?, 'CASE_OPENED_FROM_OB', ?, ?)`,
      [result.insertId, req.user.username, `Formal case opened from ${ob.ob_number} for investigation.`, caseStatus]
    );

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'CONVERT_OB_TO_CASE',
      entityType: 'cases',
      entityId: result.insertId,
      newData: { caseNumber, obNumber: ob.ob_number, originalObStaffId: ob.registered_by_user_id, status: caseStatus },
    });

    res.status(201).json({ success: true, message: 'OB entry converted to case.', caseId: result.insertId, caseNumber, obNumber: ob.ob_number });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      const [[existingCase]] = await db.query(
        'SELECT id, case_number FROM cases WHERE ob_number = ? LIMIT 1',
        [attemptedObNumber || '']
      );
      return res.status(409).json({
        success: false,
        message: 'A case already exists for this OB number.',
        caseId: existingCase?.id || null,
        caseNumber: existingCase?.case_number || null,
      });
    }
    next(err);
  }
};

const updateObEntry = async (req, res, next) => {
  try {
    const scope = buildScopeWhere(req.user, 'ob');
    const [[ob]] = await db.query(`SELECT ob.* FROM ob_entries ob WHERE ob.id=? AND ${scope.clause}`, [req.params.id, ...scope.params]);
    if (!ob) return res.status(404).json({success:false,message:'OB entry not found.'});
    if (!OB_EDITABLE_STATUSES.has(ob.status)) return res.status(409).json({success:false,message:'Only registration and preliminary-stage OB records can be updated.'});
    const allowed = ['case_title','case_type','court_level','incident_type','incident_location','incident_datetime','description','reported_by','reporter_phone','reporter_id_type','reporter_id_number','reporter_address'];
    const changes = Object.fromEntries(allowed.filter(key => req.body[key] !== undefined).map(key => [key, req.body[key]]));
    if (changes.court_level !== undefined && !OB_SUPERVISOR_ROLES.has(normalizeRole(req.user.role))) return res.status(403).json({success:false,message:'Only an authorized supervisor can update the court level.'});
    if (changes.incident_datetime) { const dateError=validateObDates({incidentDate:changes.incident_datetime,registrationDate:ob.registration_date}); if(dateError)return res.status(400).json({success:false,message:dateError}); }
    if (changes.reporter_phone && !validPhone(changes.reporter_phone)) return res.status(400).json({success:false,message:'Phone number is invalid.'});
    const keys=Object.keys(changes); if(!keys.length)return res.status(400).json({success:false,message:'No editable fields supplied.'});
    await db.query(`UPDATE ob_entries SET ${keys.map(k=>`\`${k}\`=?`).join(',')},updated_by=? WHERE id=?`, [...keys.map(k=>changes[k]),req.user.username,ob.id]);
    await audit(req,'UPDATE_OB_ENTRY','ob_entries',ob.id,Object.fromEntries(keys.map(k=>[k,ob[k]])),changes);
    res.json({success:true,message:'OB entry updated.'});
  } catch(err){next(err)}
};

const changeObStatus = async (req,res,next) => {
  try {
    const {status,reason}=req.body; const scope=buildScopeWhere(req.user,'ob');
    const [[ob]]=await db.query(`SELECT ob.* FROM ob_entries ob WHERE ob.id=? AND ${scope.clause}`,[req.params.id,...scope.params]);
    if(!ob)return res.status(404).json({success:false,message:'OB entry not found.'});
    const permitted=OB_TRANSITIONS[ob.status]||[];
    if(!permitted.includes(status))return res.status(409).json({success:false,message:`Transition from ${ob.status} to ${status} is not allowed.`});
    if(status==='CLOSED'){
      if(!OB_SUPERVISOR_ROLES.has(normalizeRole(req.user.role)))return res.status(403).json({success:false,message:'Only an authorized supervisor can close an OB record.'});
      if(!reason || String(reason).trim().length<5)return res.status(400).json({success:false,message:'A closure reason is required.'});
      const [[pending]]=await db.query("SELECT COUNT(*) count FROM ob_accused WHERE ob_entry_id=? AND status IN ('WANTED','UNDER_TRACING')",[ob.id]);
      if(Number(pending.count)>0)return res.status(409).json({success:false,message:'OB cannot be closed while an accused person is wanted or under tracing.'});
    }
    await db.query('UPDATE ob_entries SET status=?,closed_reason=IF(?=\'CLOSED\',?,closed_reason),updated_by=? WHERE id=?',[status,status,reason||null,req.user.username,ob.id]);
    await db.query('INSERT INTO ob_status_history(ob_entry_id,previous_status,new_status,reason,performed_by) VALUES(?,?,?,?,?)',[ob.id,ob.status,status,reason||null,req.user.username]);
    await audit(req,'CHANGE_OB_STATUS','ob_entries',ob.id,{status:ob.status},{status,reason}); res.json({success:true,message:'OB status updated.'});
  }catch(err){next(err)}
};

const registerAccusedArrest = async (req,res,next) => {
  try {
    const {arrest_date,arrest_location,arresting_officer,notes}=req.body;
    if(!arrest_date||!arrest_location||!arresting_officer)return res.status(400).json({success:false,message:'Arrest date, location and arresting officer are required.'});
    if(new Date(arrest_date)>new Date())return res.status(400).json({success:false,message:'Arrest date cannot be in the future.'});
    const scope=buildScopeWhere(req.user,'ob');
    const [[person]]=await db.query(`SELECT oa.*,ob.status ob_status FROM ob_accused oa JOIN ob_entries ob ON ob.id=oa.ob_entry_id WHERE oa.id=? AND oa.ob_entry_id=? AND ${scope.clause}`,[req.params.accusedId,req.params.id,...scope.params]);
    if(!person)return res.status(404).json({success:false,message:'Accused person was not found under this OB.'});
    if(person.status==='ARRESTED')return res.status(409).json({success:false,message:'This accused person is already registered as arrested.'});
    await db.query(`UPDATE ob_accused SET custody_state='IN_CUSTODY',status='ARRESTED',arrest_date=?,arrest_location=?,arresting_officer=?,custody_ready=1,updated_by=? WHERE id=?`,[arrest_date,arrest_location,arresting_officer,req.user.username,person.id]);
    await db.query('INSERT INTO ob_accused_status_history(ob_entry_id,accused_id,previous_status,new_status,action,notes,performed_by) VALUES(?,?,?,?,?,?,?)',[person.ob_entry_id,person.id,person.status,'ARRESTED','REGISTER_ARREST',notes||null,req.user.username]);
    await audit(req,'REGISTER_OB_ACCUSED_ARREST','ob_accused',person.id,{status:person.status},{status:'ARRESTED',arrest_date,arrest_location,arresting_officer,custody_ready:true});
    res.json({success:true,message:'Arrest registered on the existing OB; the accused is ready for custody intake.'});
  }catch(err){next(err)}
};

const searchWantedAccused = async(req,res,next)=>{
  try { const q=String(req.query.q||'').trim(); if(q.length<2)return res.json({success:true,data:[]}); const scope=buildScopeWhere(req.user,'ob');
    const like=`%${q}%`; const [rows]=await db.query(`SELECT oa.*,ob.ob_number,ob.case_title FROM ob_accused oa JOIN ob_entries ob ON ob.id=oa.ob_entry_id WHERE ${scope.clause} AND oa.status IN ('WANTED','UNDER_TRACING') AND (ob.ob_number LIKE ? OR oa.full_name LIKE ? OR oa.phone LIKE ? OR oa.id_number LIKE ? OR oa.identifying_information LIKE ?) ORDER BY oa.created_at DESC LIMIT 50`,[...scope.params,like,like,like,like,like]);
    res.json({success:true,data:rows}); }catch(err){next(err)}
};

module.exports = { getObEntries, getObEntryById, createObEntry, updateObEntry, changeObStatus, registerAccusedArrest, searchWantedAccused, convertObToCase, resolveObEntry, reopenObEntry, getResolutionDocument, getDeployedOfficersForLocation };
