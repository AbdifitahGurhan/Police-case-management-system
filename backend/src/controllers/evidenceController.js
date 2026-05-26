// src/controllers/evidenceController.js — Evidence upload and chain of custody
'use strict';

const path = require('path');
const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');
const { generateHash, saveBlockchainRecord } = require('../utils/hashUtil');

const applyCaseScope = (user, sql, params, alias = 'c') => {
  if (user.scopeType === 'state_administration') { sql += ` AND ${alias}.state_administration_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'region') { sql += ` AND ${alias}.region_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'city') { sql += ` AND ${alias}.city_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'district') { sql += ` AND ${alias}.district_id = ?`; params.push(user.scopeId); }
  if (user.scopeType === 'neighborhood') { sql += ` AND ${alias}.neighborhood_id = ?`; params.push(user.scopeId); }
  return sql;
};

const canAccessCase = async (user, caseId) => {
  const [[row]] = await db.query(
    'SELECT state_administration_id, region_id, city_id, district_id, neighborhood_id FROM cases WHERE id = ?',
    [caseId]
  );
  if (!row) return false;
  if (!user.scopeType) return true;
  const columnMap = {
    state_administration: 'state_administration_id',
    region: 'region_id',
    city: 'city_id',
    district: 'district_id',
    neighborhood: 'neighborhood_id',
  };
  return Number(row[columnMap[user.scopeType]]) === Number(user.scopeId);
};

/** GET /api/evidence?case_id=X */
const getEvidence = async (req, res, next) => {
  try {
    const { case_id } = req.query;
    let sql = `SELECT e.*, u.full_name AS collected_by_name
               FROM evidence e
               LEFT JOIN users u ON e.collected_by = u.username OR e.collected_by = CAST(u.id AS CHAR)
               JOIN cases c ON c.id = e.case_id
               WHERE 1=1`;
    const params = [];
    if (case_id) { sql += ' AND e.case_id = ?'; params.push(case_id); }
    sql = applyCaseScope(req.user, sql, params);
    sql += ' ORDER BY e.created_at DESC';
    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

/** GET /api/evidence/:id */
const getEvidenceById = async (req, res, next) => {
  try {
    const [[ev]] = await db.query(
      `SELECT e.*, u.full_name AS collected_by_name
       FROM evidence e
       LEFT JOIN users u ON e.collected_by = u.username OR e.collected_by = CAST(u.id AS CHAR)
       WHERE e.id = ?`,
      [req.params.id]
    );
    if (!ev) return res.status(404).json({ success: false, message: 'Evidence not found.' });
    const [custody] = await db.query(
      `SELECT coc.*, f.full_name AS from_name, t.full_name AS to_name
       FROM chain_of_custody coc
       LEFT JOIN users f ON coc.transferred_from = f.username OR coc.transferred_from = CAST(f.id AS CHAR)
       LEFT JOIN users t ON coc.transferred_to = t.username OR coc.transferred_to = CAST(t.id AS CHAR)
       WHERE coc.evidence_id = ? ORDER BY coc.transfer_date ASC`, [req.params.id]);
    res.json({ success: true, data: { ...ev, custodyLog: custody } });
  } catch (err) { next(err); }
};

/** POST /api/evidence — Upload evidence (uses multer) */
const createEvidence = async (req, res, next) => {
  try {
    const { case_id, title, description, type, collection_date, location_found } = req.body;
    if (!case_id || !title) return res.status(400).json({ success: false, message: 'case_id and title are required.' });
    if (!(await canAccessCase(req.user, case_id))) {
      return res.status(403).json({ success: false, message: 'You cannot add evidence to a case outside your station scope.' });
    }

    const year = new Date().getFullYear();
    const [[{ count }]] = await db.query('SELECT COUNT(*)+1 AS count FROM evidence WHERE case_id = ?', [case_id]);
    const evidence_number = `EV-${year}-${String(case_id).padStart(4,'0')}-${String(count).padStart(3,'0')}`;

    let fileUrl = null, fileSize = null, mimeType = null;
    if (req.file) {
      fileUrl = `/uploads/${req.file.filename}`;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
    }

    // Generate SHA-256 hash of evidence metadata + file info
    const hashData = { case_id, title, description, type, collection_date, fileUrl, evidence_number };
    const sha256Hash = generateHash(hashData);

    const [result] = await db.query(
      `INSERT INTO evidence (case_id, evidence_number, type, title, description, file_url, file_size, mime_type, collected_by, collection_date, location_found, hash_sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [case_id, evidence_number, type || 'document', title, description || null, fileUrl, fileSize, mimeType,
       req.user.id, collection_date || null, location_found || null, sha256Hash]
    );

    const evidenceId = result.insertId;

    // Save blockchain record
    await saveBlockchainRecord('evidence', evidenceId, hashData, req.user.id);

    // Initial chain of custody entry
    await db.query(`INSERT INTO chain_of_custody (evidence_id, transferred_to, reason, location) VALUES (?, ?, ?, ?)`,
      [evidenceId, req.user.id, 'Initial collection', location_found || 'Station evidence room']);

    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'UPLOAD_EVIDENCE', entityType: 'evidence', entityId: evidenceId, newData: { case_id, title, evidence_number } });
    res.status(201).json({ success: true, message: 'Evidence uploaded.', evidenceId, evidence_number, hash_sha256: sha256Hash });
  } catch (err) { next(err); }
};

/** POST /api/evidence/:id/custody — Add custody transfer */
const addCustodyTransfer = async (req, res, next) => {
  try {
    const { transferred_to, reason, location, notes } = req.body;
    if (!transferred_to) return res.status(400).json({ success: false, message: 'transferred_to is required.' });
    await db.query(`INSERT INTO chain_of_custody (evidence_id, transferred_from, transferred_to, reason, location, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, req.user.id, transferred_to, reason || null, location || null, notes || null]);
    await writeAuditLog({ userId: req.user.id, userEmail: req.user.email, action: 'CUSTODY_TRANSFER', entityType: 'evidence', entityId: parseInt(req.params.id) });
    res.status(201).json({ success: true, message: 'Custody transfer recorded.' });
  } catch (err) { next(err); }
};

module.exports = { getEvidence, getEvidenceById, createEvidence, addCustodyTransfer };
