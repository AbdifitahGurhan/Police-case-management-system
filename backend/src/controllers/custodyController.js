// src/controllers/custodyController.js - Prison custody records around a suspect identity
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const actor = (req) => req.user?.username || req.user?.id || 'system';
const normalizeOptional = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const ensureSuspect = async (suspectId) => {
  const [[row]] = await db.query('SELECT id, full_name FROM criminals WHERE id = ?', [suspectId]);
  return row || null;
};

const ensureApproval = async (approvalId) => {
  const [[approval]] = await db.query(
    `SELECT ra.*, s.full_name AS suspect_name, c.ob_number, COALESCE(c.title, c.case_title) AS case_title
     FROM release_approvals ra
     JOIN criminals s ON s.id = ra.suspect_id
     JOIN arrests a ON a.id = ra.arrest_id
     JOIN cases c ON c.id = a.case_id
     WHERE ra.id = ?`,
    [approvalId]
  );
  return approval || null;
};

const generateCertificateNumber = (approvalId) => {
  const year = new Date().getFullYear();
  return `REL-${year}-${String(approvalId).padStart(6, '0')}`;
};

const fileHash = (file) => {
  if (!file?.path) return null;
  return crypto.createHash('sha256').update(fs.readFileSync(file.path)).digest('hex');
};

const getCustodyProfile = async (req, res, next) => {
  try {
    const suspectId = req.params.id;
    const suspect = await ensureSuspect(suspectId);
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });

    const [biometrics] = await db.query('SELECT * FROM biometric_identifiers WHERE suspect_id = ? ORDER BY captured_at DESC', [suspectId]);
    const [documents] = await db.query('SELECT * FROM prisoner_documents WHERE suspect_id = ? ORDER BY uploaded_at DESC', [suspectId]);
    const [transfers] = await db.query('SELECT * FROM prison_transfers WHERE suspect_id = ? ORDER BY transfer_date DESC', [suspectId]);
    const [medical] = await db.query('SELECT * FROM prisoner_medical_records WHERE suspect_id = ? ORDER BY record_date DESC', [suspectId]);
    const [visitors] = await db.query('SELECT * FROM prisoner_visitor_logs WHERE suspect_id = ? ORDER BY visit_date DESC', [suspectId]);
    const [releaseApprovals] = await db.query('SELECT * FROM release_approvals WHERE suspect_id = ? ORDER BY requested_at DESC', [suspectId]);

    res.json({ success: true, data: { suspect, biometrics, documents, transfers, medical, visitors, releaseApprovals } });
  } catch (err) { next(err); }
};

const addBiometric = async (req, res, next) => {
  try {
    const suspectId = req.params.id;
    const { biometric_type, biometric_hash, quality_score, notes } = req.body;
    if (!biometric_type || !biometric_hash) {
      return res.status(400).json({ success: false, message: 'biometric_type and biometric_hash are required.' });
    }
    const suspect = await ensureSuspect(suspectId);
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });

    const [result] = await db.query(
      `INSERT INTO biometric_identifiers (suspect_id, biometric_type, biometric_hash, quality_score, captured_by, notes)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE suspect_id = VALUES(suspect_id), quality_score = VALUES(quality_score), notes = VALUES(notes)`,
      [suspectId, biometric_type, biometric_hash, normalizeOptional(quality_score), actor(req), normalizeOptional(notes)]
    );

    if (biometric_type === 'fingerprint' || biometric_type === 'face') {
      await db.query('UPDATE criminals SET fingerprint_hash = COALESCE(fingerprint_hash, ?) WHERE id = ?', [biometric_hash, suspectId]);
    }

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ADD_BIOMETRIC', entityType: 'criminals', entityId: Number(suspectId), newData: req.body });
    res.status(201).json({ success: true, message: 'Biometric identifier recorded.', id: result.insertId || null });
  } catch (err) { next(err); }
};

const addDocument = async (req, res, next) => {
  try {
    const suspectId = req.params.id;
    const { arrest_id, document_type, title, notes } = req.body;
    if (!document_type || !title) return res.status(400).json({ success: false, message: 'document_type and title are required.' });
    const suspect = await ensureSuspect(suspectId);
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });

    const fileUrl = req.file ? `/uploads/prisoner-documents/${req.file.filename}` : null;
    const [result] = await db.query(
      `INSERT INTO prisoner_documents (suspect_id, arrest_id, document_type, title, file_url, file_hash, uploaded_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [suspectId, normalizeOptional(arrest_id), document_type, title, fileUrl, fileHash(req.file), actor(req), normalizeOptional(notes)]
    );

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ADD_PRISONER_DOCUMENT', entityType: 'prisoner_documents', entityId: result.insertId, newData: { ...req.body, fileUrl } });
    res.status(201).json({ success: true, message: 'Document recorded.', id: result.insertId, file_url: fileUrl });
  } catch (err) { next(err); }
};

const addTransfer = async (req, res, next) => {
  try {
    const suspectId = req.params.id;
    const { arrest_id, from_facility, to_facility, transfer_reason, transfer_date, status, notes } = req.body;
    if (!to_facility || !transfer_reason) return res.status(400).json({ success: false, message: 'to_facility and transfer_reason are required.' });
    const suspect = await ensureSuspect(suspectId);
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });

    const [result] = await db.query(
      `INSERT INTO prison_transfers
       (suspect_id, arrest_id, from_facility, to_facility, transfer_reason, transfer_date, authorized_by, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [suspectId, normalizeOptional(arrest_id), normalizeOptional(from_facility), to_facility, transfer_reason, transfer_date || new Date(), actor(req), status || 'completed', normalizeOptional(notes)]
    );

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ADD_PRISON_TRANSFER', entityType: 'prison_transfers', entityId: result.insertId, newData: req.body });
    res.status(201).json({ success: true, message: 'Prison transfer recorded.', id: result.insertId });
  } catch (err) { next(err); }
};

const addMedicalRecord = async (req, res, next) => {
  try {
    const suspectId = req.params.id;
    const { arrest_id, record_date, condition_summary, treatment_given, doctor_name, facility, fitness_status } = req.body;
    if (!condition_summary) return res.status(400).json({ success: false, message: 'condition_summary is required.' });
    const suspect = await ensureSuspect(suspectId);
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });

    const [result] = await db.query(
      `INSERT INTO prisoner_medical_records
       (suspect_id, arrest_id, record_date, condition_summary, treatment_given, doctor_name, facility, fitness_status, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [suspectId, normalizeOptional(arrest_id), record_date || new Date(), condition_summary, normalizeOptional(treatment_given), normalizeOptional(doctor_name), normalizeOptional(facility), fitness_status || 'fit', actor(req)]
    );

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ADD_MEDICAL_RECORD', entityType: 'prisoner_medical_records', entityId: result.insertId, newData: req.body });
    res.status(201).json({ success: true, message: 'Medical record saved.', id: result.insertId });
  } catch (err) { next(err); }
};

const addVisitorLog = async (req, res, next) => {
  try {
    const suspectId = req.params.id;
    const { arrest_id, visitor_name, visitor_id_number, relationship, visit_date, purpose, notes } = req.body;
    if (!visitor_name) return res.status(400).json({ success: false, message: 'visitor_name is required.' });
    const suspect = await ensureSuspect(suspectId);
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });

    const [result] = await db.query(
      `INSERT INTO prisoner_visitor_logs
       (suspect_id, arrest_id, visitor_name, visitor_id_number, relationship, visit_date, purpose, approved_by, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [suspectId, normalizeOptional(arrest_id), visitor_name, normalizeOptional(visitor_id_number), normalizeOptional(relationship), visit_date || new Date(), normalizeOptional(purpose), actor(req), normalizeOptional(notes)]
    );

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ADD_VISITOR_LOG', entityType: 'prisoner_visitor_logs', entityId: result.insertId, newData: req.body });
    res.status(201).json({ success: true, message: 'Visitor log saved.', id: result.insertId });
  } catch (err) { next(err); }
};

const requestReleaseApproval = async (req, res, next) => {
  try {
    const suspectId = req.params.id;
    const { arrest_id, request_reason } = req.body;
    if (!arrest_id || !request_reason) return res.status(400).json({ success: false, message: 'arrest_id and request_reason are required.' });

    const [[arrest]] = await db.query(
      'SELECT id, suspect_id, expected_release_date, sentence_status FROM arrests WHERE id = ? AND suspect_id = ?',
      [arrest_id, suspectId]
    );
    if (!arrest) return res.status(404).json({ success: false, message: 'Arrest record not found for this suspect.' });

    const [[existing]] = await db.query(
      `SELECT id, status FROM release_approvals
       WHERE arrest_id = ? AND status NOT IN ('released','rejected')
       ORDER BY requested_at DESC LIMIT 1`,
      [arrest_id]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: `Release workflow already exists with status ${existing.status}.`, id: existing.id });
    }

    const [result] = await db.query(
      `INSERT INTO release_approvals (suspect_id, arrest_id, requested_by, request_reason, status)
       VALUES (?, ?, ?, ?, 'pending_admin_review')`,
      [suspectId, arrest_id, actor(req), request_reason]
    );

    await db.query('UPDATE arrests SET sentence_status = ? WHERE id = ? AND sentence_status IN (?, ?, ?)', ['release_review', arrest_id, 'sentenced', 'serving', 'completed']);
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'REQUEST_RELEASE_APPROVAL', entityType: 'release_approvals', entityId: result.insertId, newData: req.body });
    res.status(201).json({ success: true, message: 'Release approval request created. Waiting for admin review.', id: result.insertId, status: 'pending_admin_review' });
  } catch (err) { next(err); }
};

const adminReviewReleaseApproval = async (req, res, next) => {
  try {
    const { decision = 'approved', notes } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'decision must be approved or rejected.' });
    const approval = await ensureApproval(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Release request not found.' });
    if (approval.status !== 'pending_admin_review') return res.status(409).json({ success: false, message: `Admin review requires pending_admin_review status. Current status: ${approval.status}.` });

    const nextStatus = decision === 'approved' ? 'admin_reviewed' : 'rejected';
    await db.query(
      `UPDATE release_approvals
       SET status = ?, admin_reviewed_by = ?, admin_reviewed_at = NOW(), admin_review_notes = ?,
           reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE id = ?`,
      [nextStatus, actor(req), normalizeOptional(notes), actor(req), normalizeOptional(notes), req.params.id]
    );

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ADMIN_REVIEW_RELEASE', entityType: 'release_approvals', entityId: Number(req.params.id), oldData: approval, newData: { decision, notes } });
    res.json({ success: true, message: decision === 'approved' ? 'Admin review approved. Waiting for prison officer confirmation.' : 'Release request rejected by admin.', status: nextStatus });
  } catch (err) { next(err); }
};

const prisonConfirmReleaseApproval = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const approval = await ensureApproval(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Release request not found.' });
    if (approval.status !== 'admin_reviewed') return res.status(409).json({ success: false, message: `Prison confirmation requires admin_reviewed status. Current status: ${approval.status}.` });

    await db.query(
      `UPDATE release_approvals
       SET status = 'prison_confirmed', prison_confirmed_by = ?, prison_confirmed_at = NOW(), prison_confirmation_notes = ?,
           reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE id = ?`,
      [actor(req), normalizeOptional(notes), actor(req), normalizeOptional(notes), req.params.id]
    );

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'PRISON_CONFIRM_RELEASE', entityType: 'release_approvals', entityId: Number(req.params.id), oldData: approval, newData: { notes } });
    res.json({ success: true, message: 'Prison officer confirmed release readiness. Waiting for court/authority approval.', status: 'prison_confirmed' });
  } catch (err) { next(err); }
};

const courtApproveReleaseApproval = async (req, res, next) => {
  try {
    const { decision = 'approved', notes } = req.body;
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'decision must be approved or rejected.' });
    const approval = await ensureApproval(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Release request not found.' });
    if (approval.status !== 'prison_confirmed') return res.status(409).json({ success: false, message: `Court approval requires prison_confirmed status. Current status: ${approval.status}.` });

    const nextStatus = decision === 'approved' ? 'court_approved' : 'rejected';
    await db.query(
      `UPDATE release_approvals
       SET status = ?, court_approved_by = ?, court_approved_at = NOW(), court_approval_notes = ?,
           reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE id = ?`,
      [nextStatus, actor(req), normalizeOptional(notes), actor(req), normalizeOptional(notes), req.params.id]
    );

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'COURT_APPROVE_RELEASE', entityType: 'release_approvals', entityId: Number(req.params.id), oldData: approval, newData: { decision, notes } });
    res.json({ success: true, message: decision === 'approved' ? 'Court/authority approved release. Generate certificate to finalize.' : 'Release request rejected by court/authority.', status: nextStatus });
  } catch (err) { next(err); }
};

const generateReleaseCertificate = async (req, res, next) => {
  try {
    const { notes } = req.body;
    const approval = await ensureApproval(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Release request not found.' });
    if (!['court_approved', 'certificate_generated'].includes(approval.status)) {
      return res.status(409).json({ success: false, message: `Certificate generation requires court_approved status. Current status: ${approval.status}.` });
    }

    const certificateNumber = approval.certificate_number || generateCertificateNumber(req.params.id);
    await db.query(
      `UPDATE release_approvals
       SET status = 'released',
           certificate_number = ?,
           certificate_issued_by = COALESCE(certificate_issued_by, ?),
           certificate_issued_at = COALESCE(certificate_issued_at, NOW()),
           certificate_notes = COALESCE(?, certificate_notes),
           reviewed_by = ?, reviewed_at = NOW(), review_notes = COALESCE(?, review_notes)
       WHERE id = ?`,
      [certificateNumber, actor(req), normalizeOptional(notes), actor(req), normalizeOptional(notes), req.params.id]
    );
    await db.query(
      "UPDATE arrests SET sentence_status = 'released', actual_release_date = COALESCE(actual_release_date, CURDATE()), final_status = COALESCE(?, final_status) WHERE id = ?",
      [`Released with certificate ${certificateNumber}`, approval.arrest_id]
    );
    await db.query('UPDATE criminals SET is_arrested = 0 WHERE id = ?', [approval.suspect_id]);

    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'GENERATE_RELEASE_CERTIFICATE', entityType: 'release_approvals', entityId: Number(req.params.id), oldData: approval, newData: { certificateNumber, notes } });
    res.json({
      success: true,
      message: 'Release certificate generated. Final status: Released.',
      status: 'released',
      certificate: {
        certificate_number: certificateNumber,
        suspect_name: approval.suspect_name,
        ob_number: approval.ob_number,
        case_title: approval.case_title,
        issued_by: actor(req),
        issued_at: new Date().toISOString(),
        notes: notes || null,
      },
    });
  } catch (err) { next(err); }
};

const reviewReleaseApproval = async (req, res, next) => {
  try {
    const { status, review_notes } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ success: false, message: 'status must be approved or rejected.' });

    const approval = await ensureApproval(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Release request not found.' });

    if (status === 'rejected') {
      await db.query(
        `UPDATE release_approvals
         SET status = 'rejected', reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
         WHERE id = ?`,
        [actor(req), normalizeOptional(review_notes), req.params.id]
      );
      await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'REJECT_RELEASE_APPROVAL', entityType: 'release_approvals', entityId: Number(req.params.id), oldData: approval, newData: req.body });
      return res.json({ success: true, message: 'Release request rejected.', status: 'rejected' });
    }

    if (req.user.role === 'admin') {
      req.body.decision = 'approved';
      req.body.notes = review_notes;
      return adminReviewReleaseApproval(req, res, next);
    }
    if (req.user.role === 'court') {
      req.body.decision = 'approved';
      req.body.notes = review_notes;
      return courtApproveReleaseApproval(req, res, next);
    }

    res.status(403).json({ success: false, message: 'Use the role-specific release workflow action.' });
  } catch (err) { next(err); }
};

const getWantedEscaped = async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT a.*, s.full_name, s.alias, s.photo_url, c.ob_number, COALESCE(c.title, c.case_title) AS case_title,
             d.district_name AS police_station_name
      FROM arrests a
      JOIN criminals s ON s.id = a.suspect_id
      JOIN cases c ON c.id = a.case_id
      LEFT JOIN districts d ON COALESCE(a.police_station_id, c.district_id) = d.id
      WHERE a.sentence_status IN ('wanted','escaped')
      ORDER BY a.arrest_date DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const getPrisonAdmissions=async(_req,res,next)=>{try{const [rows]=await db.query(`SELECT pa.*,s.full_name,a.expected_release_date,pca.block_name,pca.cell_number FROM prison_admissions pa JOIN criminals s ON s.id=pa.suspect_id JOIN arrests a ON a.id=pa.arrest_id LEFT JOIN prison_cell_assignments pca ON pca.admission_id=pa.id AND pca.released_at IS NULL ORDER BY pa.admission_date DESC`);res.json({success:true,data:rows})}catch(err){next(err)}};
const admitPrisoner=async(req,res,next)=>{try{const {arrest_id,suspect_id,facility,notes,property_inventory}=req.body;if(!arrest_id||!suspect_id||!facility)return res.status(400).json({success:false,message:'arrest_id, suspect_id, and facility are required.'});let inventory=[];try{inventory=property_inventory?JSON.parse(property_inventory):[]}catch{return res.status(400).json({success:false,message:'Property inventory must be valid JSON.'})}if(!Array.isArray(inventory))return res.status(400).json({success:false,message:'Property inventory must be a list.'});const prisonNumber=`PR-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`;const [result]=await db.query(`INSERT INTO prison_admissions(arrest_id,suspect_id,prison_number,facility,admitted_by,notes,photo_url,commitment_warrant_url,property_inventory,confirmed_at) VALUES(?,?,?,?,?,?,?,?,?,NOW())`,[arrest_id,suspect_id,prisonNumber,facility,req.user.username,notes||null,req.files?.photo?.[0]?`/uploads/prisoner-documents/${req.files.photo[0].filename}`:null,req.files?.commitment_warrant?.[0]?`/uploads/prisoner-documents/${req.files.commitment_warrant[0].filename}`:null,JSON.stringify(inventory)]);res.status(201).json({success:true,message:'Prison admission confirmed.',id:result.insertId,prison_number:prisonNumber})}catch(err){next(err)}};
const getPrisonCells=async(_req,res,next)=>{try{const [rows]=await db.query(`SELECT pc.*,COUNT(pca.id) occupied,pc.capacity-COUNT(pca.id) available FROM prison_cells pc LEFT JOIN prison_cell_assignments pca ON pca.facility=pc.facility AND pca.block_name=pc.block_name AND pca.cell_number=pc.cell_number AND pca.released_at IS NULL GROUP BY pc.id ORDER BY pc.facility,pc.block_name,pc.cell_number`);res.json({success:true,data:rows})}catch(err){next(err)}};
const savePrisonCell=async(req,res,next)=>{try{const {facility,block_name,cell_number,capacity}=req.body;if(!facility||!block_name||!cell_number||Number(capacity)<1)return res.status(400).json({success:false,message:'facility, block_name, cell_number, and capacity are required.'});await db.query(`INSERT INTO prison_cells(facility,block_name,cell_number,capacity) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE capacity=VALUES(capacity),is_active=1`,[facility,block_name,cell_number,capacity]);res.json({success:true,message:'Prison cell saved.'})}catch(err){next(err)}};
const assignPrisonCell=async(req,res,next)=>{try{const {facility,block_name,cell_number,notes}=req.body;const [[cell]]=await db.query(`SELECT pc.*,COUNT(pca.id) occupied FROM prison_cells pc LEFT JOIN prison_cell_assignments pca ON pca.facility=pc.facility AND pca.block_name=pc.block_name AND pca.cell_number=pc.cell_number AND pca.released_at IS NULL WHERE pc.facility=? AND pc.block_name=? AND pc.cell_number=? GROUP BY pc.id`,[facility,block_name,cell_number]);if(!cell)return res.status(404).json({success:false,message:'Cell not found.'});if(Number(cell.occupied)>=Number(cell.capacity))return res.status(409).json({success:false,message:'Cell is full.'});await db.query('UPDATE prison_cell_assignments SET released_at=NOW() WHERE admission_id=? AND released_at IS NULL',[req.params.id]);await db.query(`INSERT INTO prison_cell_assignments(admission_id,facility,block_name,cell_number,assigned_by,notes) VALUES(?,?,?,?,?,?)`,[req.params.id,facility,block_name,cell_number,req.user.username,notes||null]);res.json({success:true,message:'Cell assigned.'})}catch(err){next(err)}};
const recordRollCall=async(req,res,next)=>{try{const {roll_date,shift,status,notes}=req.body;if(!roll_date||!shift||!status)return res.status(400).json({success:false,message:'roll_date, shift, and status are required.'});await db.query(`INSERT INTO prison_roll_calls(admission_id,roll_date,shift,status,notes,recorded_by) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),notes=VALUES(notes),recorded_by=VALUES(recorded_by)`,[req.params.id,roll_date,shift,status,notes||null,req.user.username]);res.json({success:true,message:'Roll call recorded.'})}catch(err){next(err)}};
const bulkRollCall=async(req,res,next)=>{try{const {roll_date,shift,entries}=req.body;if(!roll_date||!shift||!Array.isArray(entries)||!entries.length)return res.status(400).json({success:false,message:'roll_date, shift, and entries are required.'});for(const entry of entries)await db.query(`INSERT INTO prison_roll_calls(admission_id,roll_date,shift,status,notes,recorded_by) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),notes=VALUES(notes),recorded_by=VALUES(recorded_by)`,[entry.admission_id,roll_date,shift,entry.status||'present',entry.notes||null,req.user.username]);res.json({success:true,message:`Roll call saved for ${entries.length} prisoners.`})}catch(err){next(err)}};
module.exports = {
  getCustodyProfile,
  addBiometric,
  addDocument,
  addTransfer,
  addMedicalRecord,
  addVisitorLog,
  requestReleaseApproval,
  adminReviewReleaseApproval,
  prisonConfirmReleaseApproval,
  courtApproveReleaseApproval,
  generateReleaseCertificate,
  reviewReleaseApproval,
  getWantedEscaped,
  getPrisonAdmissions, admitPrisoner, assignPrisonCell, recordRollCall,
  getPrisonCells, savePrisonCell, bulkRollCall,
};
