// src/controllers/custodyController.js - Prison custody records around a suspect identity
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { syncCriminalCustodyStatus } = require('../utils/custodyStatus');

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
    const [[suspect]] = await db.query(
      `SELECT s.*,
              (SELECT COUNT(*) FROM case_criminals cs WHERE cs.criminal_id = s.id AND cs.status = 'active') AS case_count
       FROM criminals s
       WHERE s.id = ?`,
      [suspectId]
    );
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });

    const [biometrics] = await db.query('SELECT * FROM biometric_identifiers WHERE suspect_id = ? ORDER BY captured_at DESC', [suspectId]);
    const [documents] = await db.query('SELECT * FROM prisoner_documents WHERE suspect_id = ? ORDER BY uploaded_at DESC', [suspectId]);
    const [transfers] = await db.query('SELECT * FROM prison_transfers WHERE suspect_id = ? ORDER BY transfer_date DESC', [suspectId]);
    const [medical] = await db.query('SELECT * FROM prisoner_medical_records WHERE suspect_id = ? ORDER BY record_date DESC', [suspectId]);
    const [visitors] = await db.query('SELECT * FROM prisoner_visitor_logs WHERE suspect_id = ? ORDER BY visit_date DESC', [suspectId]);
    const [releaseApprovals] = await db.query('SELECT * FROM release_approvals WHERE suspect_id = ? ORDER BY requested_at DESC', [suspectId]);
    const [arrests] = await db.query(
      `SELECT a.*,
              c.ob_number,
              COALESCE(c.title, c.case_title) AS case_title,
              d.district_name AS station_name
       FROM arrests a
       LEFT JOIN cases c ON c.id = a.case_id
       LEFT JOIN districts d ON d.id = COALESCE(a.police_station_id, c.district_id)
       WHERE a.suspect_id = ?
       ORDER BY a.arrest_date DESC`,
      [suspectId]
    );

    res.json({
      success: true,
      data: { suspect, biometrics, documents, transfers, medical, visitors, releaseApprovals, arrests },
    });
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
    const { decision = 'approved', notes } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'decision must be approved or rejected.' });
    }
    const approval = await ensureApproval(req.params.id);
    if (!approval) return res.status(404).json({ success: false, message: 'Release request not found.' });
    if (approval.status !== 'admin_reviewed') {
      return res.status(409).json({
        success: false,
        message: `Prison confirmation requires admin_reviewed status. Current status: ${approval.status}.`,
      });
    }

    const nextStatus = decision === 'approved' ? 'prison_confirmed' : 'rejected';
    await db.query(
      `UPDATE release_approvals
       SET status = ?, prison_confirmed_by = ?, prison_confirmed_at = NOW(), prison_confirmation_notes = ?,
           reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
       WHERE id = ?`,
      [nextStatus, actor(req), normalizeOptional(notes), actor(req), normalizeOptional(notes), req.params.id]
    );

    await writeAuditLog({
      userId: actor(req),
      userEmail: req.user.email || req.user.username,
      action: decision === 'approved' ? 'PRISON_CONFIRM_RELEASE' : 'PRISON_REJECT_RELEASE',
      entityType: 'release_approvals',
      entityId: Number(req.params.id),
      oldData: approval,
      newData: { decision, notes },
    });
    res.json({
      success: true,
      message: decision === 'approved'
        ? 'Prison officer confirmed release readiness. Waiting for court/authority approval.'
        : 'Release request rejected by prison officer.',
      status: nextStatus,
    });
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

    // Step 5: court_approved → certificate_generated (issue number, do not release yet)
    if (approval.status === 'court_approved') {
      const certificateNumber = generateCertificateNumber(req.params.id);
      await db.query(
        `UPDATE release_approvals
         SET status = 'certificate_generated',
             certificate_number = ?,
             certificate_issued_by = ?,
             certificate_issued_at = NOW(),
             certificate_notes = ?,
             reviewed_by = ?, reviewed_at = NOW(), review_notes = COALESCE(?, review_notes)
         WHERE id = ?`,
        [certificateNumber, actor(req), normalizeOptional(notes), actor(req), normalizeOptional(notes), req.params.id]
      );
      await writeAuditLog({
        userId: actor(req),
        userEmail: req.user.email || req.user.username,
        action: 'GENERATE_RELEASE_CERTIFICATE',
        entityType: 'release_approvals',
        entityId: Number(req.params.id),
        oldData: approval,
        newData: { certificateNumber, status: 'certificate_generated', notes },
      });
      return res.json({
        success: true,
        message: 'Release certificate generated. Confirm release to finalize.',
        status: 'certificate_generated',
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
    }

    // Step 6: certificate_generated → released
    if (approval.status === 'certificate_generated') {
      const certificateNumber = approval.certificate_number || generateCertificateNumber(req.params.id);
      const connection = await db.pool.getConnection();
      try {
        await connection.beginTransaction();

        await connection.query(
          `UPDATE release_approvals
           SET status = 'released',
               certificate_number = COALESCE(certificate_number, ?),
               reviewed_by = ?, reviewed_at = NOW(), review_notes = COALESCE(?, review_notes)
           WHERE id = ?`,
          [certificateNumber, actor(req), normalizeOptional(notes), req.params.id]
        );
        await connection.query(
          "UPDATE arrests SET sentence_status = 'released', actual_release_date = COALESCE(actual_release_date, CURDATE()), final_status = COALESCE(?, final_status) WHERE id = ?",
          [`Released with certificate ${certificateNumber}`, approval.arrest_id]
        );
        // Recompute from the suspect's latest arrest record so the custody record and
        // the profile flag change atomically with the certificate/arrest updates above.
        await syncCriminalCustodyStatus(connection, approval.suspect_id);

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }

      await writeAuditLog({
        userId: actor(req),
        userEmail: req.user.email || req.user.username,
        action: 'FINALIZE_RELEASE',
        entityType: 'release_approvals',
        entityId: Number(req.params.id),
        oldData: approval,
        newData: { certificateNumber, status: 'released', notes },
      });
      return res.json({
        success: true,
        message: 'Prisoner released. Final status: Released.',
        status: 'released',
        certificate: {
          certificate_number: certificateNumber,
          suspect_name: approval.suspect_name,
          ob_number: approval.ob_number,
          case_title: approval.case_title,
          issued_by: approval.certificate_issued_by || actor(req),
          issued_at: approval.certificate_issued_at || new Date().toISOString(),
          notes: notes || approval.certificate_notes || null,
        },
      });
    }

    return res.status(409).json({
      success: false,
      message: `Certificate/release requires court_approved or certificate_generated status. Current status: ${approval.status}.`,
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

const normalizePropertyInventory = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value).trim();
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return JSON.stringify({ description: text });
  }
};

const assertCellCapacity = async (connection, facility, blockName, cellNumber, excludeAdmissionId = null) => {
  const [[cell]] = await connection.query(
    'SELECT id, capacity, is_active FROM prison_cells WHERE facility = ? AND block_name = ? AND cell_number = ? FOR UPDATE',
    [facility, blockName, cellNumber]
  );
  if (!cell || !cell.is_active) throw Object.assign(new Error('Selected prison cell is not configured or is inactive.'), { status: 400 });
  const params = [facility, blockName, cellNumber];
  let exclude = '';
  if (excludeAdmissionId) { exclude = ' AND pca.admission_id <> ?'; params.push(excludeAdmissionId); }
  const [[occupancy]] = await connection.query(
    `SELECT COUNT(*) AS total FROM prison_cell_assignments pca
      JOIN prison_admissions pa ON pa.id = pca.admission_id AND pa.status = 'admitted'
     WHERE pca.facility = ? AND pca.block_name = ? AND pca.cell_number = ?
       AND pca.released_at IS NULL${exclude}`,
    params
  );
  if (Number(occupancy.total) >= Number(cell.capacity)) {
    throw Object.assign(new Error(`Cell is full (${occupancy.total}/${cell.capacity}).`), { status: 409 });
  }
  return { cell, occupancy: Number(occupancy.total) };
};

const getPrisonAdmissions = async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pa.*, s.full_name, COALESCE(pa.photo_url, s.photo_url) AS prisoner_photo_url, a.case_id, a.sentence_status,
             a.sentence_start_date, a.expected_release_date, c.case_number, c.ob_number,
             cell.block_name, cell.cell_number,
             pc.capacity AS cell_capacity,
             (SELECT COUNT(*) FROM prison_cell_assignments occupied
               JOIN prison_admissions active_pa ON active_pa.id = occupied.admission_id AND active_pa.status = 'admitted'
              WHERE occupied.facility = cell.facility AND occupied.block_name = cell.block_name
                AND occupied.cell_number = cell.cell_number AND occupied.released_at IS NULL) AS cell_occupancy,
             CASE WHEN a.expected_release_date IS NULL THEN NULL ELSE DATEDIFF(a.expected_release_date, CURDATE()) END AS days_remaining,
             rc.roll_date AS last_roll_date, rc.shift AS last_roll_shift, rc.status AS last_roll_status
        FROM prison_admissions pa
        JOIN criminals s ON s.id = pa.suspect_id
        JOIN arrests a ON a.id = pa.arrest_id
        JOIN cases c ON c.id = a.case_id
        LEFT JOIN prison_cell_assignments cell ON cell.id = (
          SELECT ca.id FROM prison_cell_assignments ca
           WHERE ca.admission_id = pa.id AND ca.released_at IS NULL ORDER BY ca.id DESC LIMIT 1
        )
        LEFT JOIN prison_cells pc ON pc.facility = cell.facility AND pc.block_name = cell.block_name AND pc.cell_number = cell.cell_number
        LEFT JOIN prison_roll_calls rc ON rc.id = (
          SELECT prc.id FROM prison_roll_calls prc
           WHERE prc.admission_id = pa.id ORDER BY prc.roll_date DESC, prc.id DESC LIMIT 1
        )
       WHERE pa.status = 'admitted'
       ORDER BY pa.admission_date DESC
    `);
    const [eligible] = await db.query(`
      SELECT a.id AS arrest_id, a.suspect_id, s.full_name, c.case_number, c.ob_number,
             a.sentence_status, a.sentence_start_date, a.expected_release_date
        FROM arrests a
        JOIN criminals s ON s.id = a.suspect_id
        JOIN cases c ON c.id = a.case_id
        LEFT JOIN prison_admissions pa ON pa.arrest_id = a.id
       WHERE a.sentence_status IN ('awaiting_trial','sentenced','serving') AND pa.id IS NULL
       ORDER BY a.arrest_date DESC
    `);
    res.json({ success: true, data: rows, eligible });
  } catch (err) { next(err); }
};

const admitPrisoner = async (req, res, next) => {
  try {
    const { arrest_id, facility, admission_date, block_name, cell_number, notes, property_inventory } = req.body;
    if (!arrest_id || !facility) return res.status(400).json({ success: false, message: 'arrest_id and facility are required.' });
    const connection = await db.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[arrest]] = await connection.query(
        `SELECT a.*, s.full_name FROM arrests a JOIN criminals s ON s.id = a.suspect_id WHERE a.id = ? FOR UPDATE`,
        [arrest_id]
      );
      if (!arrest) throw Object.assign(new Error('Custody/arrest record not found.'), { status: 404 });
      if (!['sentenced', 'serving', 'awaiting_trial'].includes(arrest.sentence_status)) {
        throw Object.assign(new Error('This person is not eligible for prison admission.'), { status: 409 });
      }
      const [[existing]] = await connection.query('SELECT id FROM prison_admissions WHERE arrest_id = ?', [arrest_id]);
      if (existing) throw Object.assign(new Error('This custody record has already been admitted.'), { status: 409 });
      const prisonNumber = `PR-${new Date().getFullYear()}-${String(arrest_id).padStart(6, '0')}`;
      if (block_name && cell_number) await assertCellCapacity(connection, facility, block_name, cell_number);
      const photo = req.files?.photo?.[0];
      const warrant = req.files?.commitment_warrant?.[0];
      const photoUrl = photo ? `/uploads/prisoner-documents/${photo.filename}` : null;
      const warrantUrl = warrant ? `/uploads/prisoner-documents/${warrant.filename}` : null;
      const [insert] = await connection.query(
        `INSERT INTO prison_admissions
          (arrest_id, suspect_id, prison_number, facility, admission_date, admitted_by, notes,
           photo_url, commitment_warrant_url, property_inventory, confirmed_at)
         VALUES (?, ?, ?, ?, COALESCE(?, NOW()), ?, ?, ?, ?, ?, NOW())`,
        [arrest_id, arrest.suspect_id, prisonNumber, facility, admission_date || null, actor(req), normalizeOptional(notes),
          photoUrl, warrantUrl, normalizePropertyInventory(property_inventory)]
      );
      if (block_name && cell_number) {
        await connection.query(
          `INSERT INTO prison_cell_assignments (admission_id, facility, block_name, cell_number, assigned_by, notes)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [insert.insertId, facility, block_name, cell_number, actor(req), 'Initial admission assignment']
        );
      }
      await connection.query("UPDATE arrests SET sentence_status = 'serving' WHERE id = ? AND sentence_status = 'sentenced'", [arrest_id]);
      await syncCriminalCustodyStatus(connection, arrest.suspect_id);
      await connection.commit();
      await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'PRISON_ADMISSION', entityType: 'prison_admissions', entityId: insert.insertId, newData: { ...req.body, prison_number: prisonNumber } });
      res.status(201).json({ success: true, message: 'Prison admission completed.', admissionId: insert.insertId, prisonNumber });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally { connection.release(); }
  } catch (err) { next(err); }
};

const assignPrisonCell = async (req, res, next) => {
  try {
    const { facility, block_name, cell_number, notes } = req.body;
    if (!facility || !block_name || !cell_number) return res.status(400).json({ success: false, message: 'facility, block_name, and cell_number are required.' });
    const connection = await db.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [[admission]] = await connection.query("SELECT id FROM prison_admissions WHERE id = ? AND status = 'admitted' FOR UPDATE", [req.params.id]);
      if (!admission) throw Object.assign(new Error('Active prison admission not found.'), { status: 404 });
      await assertCellCapacity(connection, facility, block_name, cell_number, req.params.id);
      await connection.query('UPDATE prison_cell_assignments SET released_at = NOW() WHERE admission_id = ? AND released_at IS NULL', [req.params.id]);
      const [insert] = await connection.query(
        `INSERT INTO prison_cell_assignments (admission_id, facility, block_name, cell_number, assigned_by, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.params.id, facility, block_name, cell_number, actor(req), normalizeOptional(notes)]
      );
      await connection.query('UPDATE prison_admissions SET facility = ? WHERE id = ?', [facility, req.params.id]);
      await connection.commit();
      await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'ASSIGN_PRISON_CELL', entityType: 'prison_cell_assignments', entityId: insert.insertId, newData: req.body });
      res.status(201).json({ success: true, message: 'Cell assignment saved.' });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (err) { next(err); }
};

const recordRollCall = async (req, res, next) => {
  try {
    const { roll_date, shift, status, notes } = req.body;
    if (!roll_date || !['morning', 'afternoon', 'night'].includes(shift) || !['present', 'absent', 'hospital', 'court', 'transfer'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Valid roll_date, shift, and status are required.' });
    }
    const [result] = await db.query(
      `INSERT INTO prison_roll_calls (admission_id, roll_date, shift, status, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes), recorded_by = VALUES(recorded_by), recorded_at = NOW()`,
      [req.params.id, roll_date, shift, status, normalizeOptional(notes), actor(req)]
    );
    await writeAuditLog({ userId: actor(req), userEmail: req.user.email || req.user.username, action: 'PRISON_ROLL_CALL', entityType: 'prison_roll_calls', entityId: result.insertId || Number(req.params.id), newData: req.body });
    res.json({ success: true, message: 'Roll call recorded.' });
  } catch (err) { next(err); }
};

const getPrisonCells = async (_req, res, next) => {
  try {
    const [rows] = await db.query(`
      SELECT pc.*,
             (SELECT COUNT(*) FROM prison_cell_assignments pca
               JOIN prison_admissions pa ON pa.id = pca.admission_id AND pa.status = 'admitted'
              WHERE pca.facility = pc.facility AND pca.block_name = pc.block_name
                AND pca.cell_number = pc.cell_number AND pca.released_at IS NULL) AS occupancy
        FROM prison_cells pc WHERE pc.is_active = 1
       ORDER BY pc.facility, pc.block_name, pc.cell_number
    `);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

const savePrisonCell = async (req, res, next) => {
  try {
    const { facility, block_name, cell_number, capacity } = req.body;
    if (!facility || !block_name || !cell_number || Number(capacity) < 1) {
      return res.status(400).json({ success: false, message: 'facility, block_name, cell_number, and positive capacity are required.' });
    }
    await db.query(
      `INSERT INTO prison_cells (facility, block_name, cell_number, capacity)
       VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE capacity = VALUES(capacity), is_active = 1`,
      [facility, block_name, cell_number, Number(capacity)]
    );
    res.json({ success: true, message: 'Cell capacity saved.' });
  } catch (err) { next(err); }
};

const bulkRollCall = async (req, res, next) => {
  try {
    const { roll_date, shift, entries } = req.body;
    if (!roll_date || !['morning', 'afternoon', 'night'].includes(shift) || !Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ success: false, message: 'roll_date, shift, and entries are required.' });
    }
    const allowed = new Set(['present', 'absent', 'hospital', 'court', 'transfer']);
    const connection = await db.pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const entry of entries) {
        if (!entry.admission_id || !allowed.has(entry.status)) throw Object.assign(new Error('Every roll-call entry requires a valid admission and status.'), { status: 400 });
        await connection.query(
          `INSERT INTO prison_roll_calls (admission_id, roll_date, shift, status, notes, recorded_by)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status = VALUES(status), notes = VALUES(notes), recorded_by = VALUES(recorded_by), recorded_at = NOW()`,
          [entry.admission_id, roll_date, shift, entry.status, normalizeOptional(entry.notes), actor(req)]
        );
      }
      await connection.commit();
      const absent = entries.filter((entry) => entry.status === 'absent').length;
      res.json({ success: true, message: `Roll call saved for ${entries.length} prisoners.`, absent });
    } catch (error) { await connection.rollback(); throw error; } finally { connection.release(); }
  } catch (err) { next(err); }
};

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
  getPrisonAdmissions,
  admitPrisoner,
  assignPrisonCell,
  recordRollCall,
  getPrisonCells,
  savePrisonCell,
  bulkRollCall,
};
