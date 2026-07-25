'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { generateOBNumber } = require('../utils/obNumberGenerator');
const { generateCaseNumber } = require('../utils/caseNumberGenerator');
const { buildScopeWhere, getUserLocation, normalizeRole } = require('../utils/locationScope');
const { validateObDates } = require('../utils/dateValidation');
const { ensureCidCaseForPoliceCase } = require('../services/cidService');

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
    const { status, registered_by_user_id } = req.query;
    const scope = buildScopeWhere(req.user, 'ob');
    const params = [...scope.params];
    let whereClause = scope.clause;

    if (normalizeRole(req.user.role) === 'ob_staff') {
      whereClause += ' AND ob.registered_by_user_id = ?';
      params.push(req.user.id);
    } else if (registered_by_user_id) {
      whereClause += ' AND ob.registered_by_user_id = ?';
      params.push(registered_by_user_id);
    }
    if (status) {
      whereClause += ' AND ob.status = ?';
      params.push(status);
    }

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
    const [resolutionDocuments] = await db.query('SELECT id,document_type,document_title,created_by,created_at FROM ob_resolution_documents WHERE ob_entry_id=? ORDER BY created_at DESC',[req.params.id]);
    res.json({ success: true, data: { ...row, attachments, resolutionDocuments } });
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

const createObEntry = async (req, res, next) => {
  try {
    const { incident_type, incident_location, description, reported_by, reporter_phone, case_title, case_type, case_level,
      reporter_id_type, reporter_id_number, reporter_email, reporter_address, respondent_name, respondent_id_type,
      respondent_id_number, respondent_phone, respondent_email, respondent_address, incident_datetime, claim_value } = req.body;
    if (!incident_type || !incident_location || !reported_by) {
      return res.status(400).json({ success: false, message: 'incident_type, incident_location, and reported_by are required.' });
    }
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
    for (let attempt = 0; attempt < 3; attempt += 1) {
      obNumber = await generateOBNumber();
      try {
        [result] = await db.query(
          `INSERT INTO ob_entries
            (ob_number, case_title, case_type, case_level, incident_type, incident_location, incident_datetime, claim_value,
             description, reported_by, reporter_phone, reporter_id_type, reporter_id_number, reporter_email, reporter_address,
             respondent_name, respondent_id_type, respondent_id_number, respondent_phone, respondent_email, respondent_address,
             registered_by_user_id, registered_by_name, registered_by_role, registered_by_rank,
             state_administration_id, region_id, district_id,
             registration_date, registration_time, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OB_REGISTERED')`,
          [
            obNumber, case_title || null, case_type || null, case_level || 'normal', incident_type, incident_location,
            incident_datetime || null, claim_value || null, description || null, reported_by, reporter_phone || null,
            reporter_id_type || null, reporter_id_number || null, reporter_email || null, reporter_address || null,
            respondent_name || null, respondent_id_type || null, respondent_id_number || null, respondent_phone || null,
            respondent_email || null, respondent_address || null,
            req.user.id,
            req.user.fullName || req.user.username,
            req.user.roleCode || req.user.role,
            req.user.rank || null,
            location.state_administration_id || null,
            location.region_id || null,
            location.district_id || null,
            now.toISOString().slice(0, 10),
            now.toTimeString().slice(0, 8),
          ]
        );
        break;
      } catch (err) {
        if (err.code !== 'ER_DUP_ENTRY' || attempt === 2) throw err;
      }
    }
    for (const file of req.files || []) {
      await db.query('INSERT INTO ob_attachments (ob_entry_id,file_name,file_url,mime_type,file_size,uploaded_by) VALUES (?,?,?,?,?,?)', [result.insertId,file.originalname,`/uploads/ob/${file.filename}`,file.mimetype,file.size,req.user.username]);
    }

    await writeAuditLog({
      userId: req.user.username,
      userEmail: req.user.email || req.user.username,
      action: 'CREATE_OB_ENTRY',
      entityType: 'ob_entries',
      entityId: result.insertId,
      newData: { obNumber, incident_type, incident_location, location },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({ success: true, message: 'OB entry registered.', obEntryId: result.insertId, obNumber });
  } catch (err) { next(err); }
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
             complainant_phone = COALESCE(complainant_phone, ?)
         WHERE id = ?`,
        [
          ob.id,
          ob.state_administration_id || null,
          ob.region_id || null,
          ob.city_id || null,
          ob.district_id || null,
          ob.reported_by || null,
          ob.reporter_phone || null,
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
        (case_number, case_title, title, ob_number, ob_entry_id, original_ob_staff_id, original_ob_staff_name,
         incident_type, description, incident_location, status, priority, state_administration_id, region_id, city_id,
         district_id, assigned_officer_id, created_by, complainant_name, complainant_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        caseNumber,
        ob.incident_type,
        ob.incident_type,
        ob.ob_number,
        ob.id,
        ob.registered_by_user_id,
        ob.registered_by_name,
        ob.incident_type,
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
      ]
    );

    // Insert automatic CID referral
    await db.query(
      `INSERT INTO referrals (case_id, referred_by, referred_to_role, reason, status)
       VALUES (?, ?, 'cid', 'Automatic referral on OB conversion', 'accepted')`,
      [result.insertId, req.user.username]
    );

    // Sync to CID cases
    await ensureCidCaseForPoliceCase(result.insertId, req.user.username);

    await db.query('UPDATE ob_entries SET status = ? WHERE id = ?', ['CONVERTED_TO_CASE', ob.id]);
    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description, status_after)
       VALUES (?, ?, 'CASE_OPENED_FROM_OB', ?, ?)`,
      [result.insertId, req.user.username, `Formal case opened from ${ob.ob_number} and automatically referred to CID.`, caseStatus]
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

module.exports = { getObEntries, getObEntryById, createObEntry, convertObToCase, resolveObEntry, reopenObEntry, getResolutionDocument };
