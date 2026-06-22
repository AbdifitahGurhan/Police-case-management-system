// src/controllers/arrestController.js - Arrest, sentence, and custody tracking
'use strict';

const db = require('../config/database');
const { writeAuditLog } = require('../utils/auditLogger');

const SENTENCE_STATUSES = new Set([
  'awaiting_trial',
  'sentenced',
  'serving',
  'release_review',
  'completed',
  'released',
  'wanted',
  'escaped',
  'acquitted',
  'dismissed',
]);

const COURT_DECISIONS = new Set(['pending', 'convicted', 'acquitted', 'dismissed', 'adjourned']);
const SENTENCE_UNITS = new Set(['days', 'months', 'years']);

const normalizeOptional = (value) => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
};

const formatDate = (date) => date.toISOString().slice(0, 10);

const calculateExpectedReleaseDate = (startDate, value, unit) => {
  if (!startDate || !value || !unit || !SENTENCE_UNITS.has(unit)) return null;
  const parsedValue = Number(value);
  const date = new Date(`${startDate}T00:00:00Z`);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0 || Number.isNaN(date.getTime())) return null;

  if (unit === 'days') date.setUTCDate(date.getUTCDate() + parsedValue);
  if (unit === 'months') date.setUTCMonth(date.getUTCMonth() + parsedValue);
  if (unit === 'years') date.setUTCFullYear(date.getUTCFullYear() + parsedValue);
  return formatDate(date);
};

const sentenceMetrics = (row) => {
  if (!row.sentence_start_date || !row.expected_release_date) {
    return { served_days: 0, remaining_days: null, sentence_progress_percent: 0, release_due: false };
  }

  const start = new Date(`${row.sentence_start_date}T00:00:00Z`);
  const release = new Date(`${row.expected_release_date}T00:00:00Z`);
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const totalDays = Math.max(1, Math.ceil((release - start) / 86400000));
  const servedDays = Math.max(0, Math.min(totalDays, Math.floor((todayUtc - start) / 86400000)));
  const remainingDays = Math.max(0, Math.ceil((release - todayUtc) / 86400000));
  const releaseDue = todayUtc >= release && ['sentenced', 'serving', 'release_review'].includes(row.sentence_status);

  return {
    served_days: servedDays,
    remaining_days: remainingDays,
    sentence_progress_percent: Math.min(100, Math.round((servedDays / totalDays) * 100)),
    release_due: releaseDue,
  };
};

const hydrateArrests = (rows) => rows.map((row) => ({ ...row, ...sentenceMetrics(row) }));

const getCaseStationId = async (caseId) => {
  const [[caseRow]] = await db.query('SELECT district_id FROM cases WHERE id = ?', [caseId]);
  return caseRow?.district_id || null;
};

const applyCaseScope = (user, sql, params) => {
  if (user.scopeType === 'state_administration') { sql += ' AND c.state_administration_id = ?'; params.push(user.scopeId); }
  if (user.scopeType === 'region') { sql += ' AND c.region_id = ?'; params.push(user.scopeId); }
  if (user.scopeType === 'city') { sql += ' AND c.city_id = ?'; params.push(user.scopeId); }
  if (user.scopeType === 'district') { sql += ' AND c.district_id = ?'; params.push(user.scopeId); }
  return sql;
};

const canAccessCase = async (user, caseId) => {
  const [[caseRow]] = await db.query(
    `SELECT state_administration_id, region_id, city_id, district_id
     FROM cases
     WHERE id = ?`,
    [caseId]
  );
  if (!caseRow) return false;
  if (!user.scopeType) return true;
  const columnMap = {
    state_administration: 'state_administration_id',
    region: 'region_id',
    city: 'city_id',
    district: 'district_id',
  };
  return Number(caseRow[columnMap[user.scopeType]]) === Number(user.scopeId);
};

/** GET /api/arrests?case_id=X&suspect_id=Y */
const getArrests = async (req, res, next) => {
  try {
    const { case_id, suspect_id, due_for_release } = req.query;
    let sql = `
      SELECT a.*,
             s.full_name AS suspect_name,
             s.alias AS suspect_alias,
             COALESCE(u.full_name, a.arrested_by) AS arrested_by_name,
             COALESCE(c.title, c.case_title) AS case_title,
             c.ob_number,
             c.status AS case_status,
             d.district_name AS police_station_name
      FROM arrests a
      JOIN criminals s ON a.suspect_id = s.id
      JOIN cases c ON a.case_id = c.id
      LEFT JOIN users u ON a.arrested_by = CAST(u.id AS CHAR) OR a.arrested_by = u.username
      LEFT JOIN districts d ON COALESCE(a.police_station_id, c.district_id) = d.id
      WHERE 1=1
    `;
    const params = [];
    if (case_id) { sql += ' AND a.case_id = ?'; params.push(case_id); }
    if (suspect_id) { sql += ' AND a.suspect_id = ?'; params.push(suspect_id); }
    if (due_for_release === '1' || due_for_release === 'true') {
      sql += " AND a.expected_release_date <= CURDATE() AND a.sentence_status IN ('sentenced','serving','release_review')";
    }

    sql = applyCaseScope(req.user, sql, params);
    const [rows] = await db.query(`${sql} ORDER BY a.arrest_date DESC`, params);
    res.json({ success: true, data: hydrateArrests(rows) });
  } catch (err) { next(err); }
};

/** POST /api/arrests - Record new arrest */
const createArrest = async (req, res, next) => {
  try {
    const {
      case_id,
      suspect_id,
      arrest_date,
      arrest_location,
      charges,
      bail_status,
      bail_amount,
      notes,
      court_decision = 'pending',
      court_decision_notes,
      sentence_period_value,
      sentence_period_unit,
      sentence_start_date,
    } = req.body;

    if (!case_id || !suspect_id) {
      return res.status(400).json({ success: false, message: 'case_id and suspect_id are required.' });
    }
    if (!(await canAccessCase(req.user, case_id))) {
      return res.status(403).json({ success: false, message: 'You cannot arrest a suspect for a case outside your station scope.' });
    }
    if (court_decision && !COURT_DECISIONS.has(court_decision)) {
      return res.status(400).json({ success: false, message: 'Invalid court decision.' });
    }
    if (sentence_period_unit && !SENTENCE_UNITS.has(sentence_period_unit)) {
      return res.status(400).json({ success: false, message: 'Sentence unit must be days, months, or years.' });
    }

    const [[suspect]] = await db.query('SELECT id, full_name FROM criminals WHERE id = ?', [suspect_id]);
    if (!suspect) return res.status(404).json({ success: false, message: 'Suspect not found.' });

    const policeStationId = await getCaseStationId(case_id);
    const expectedReleaseDate = calculateExpectedReleaseDate(sentence_start_date, sentence_period_value, sentence_period_unit);
    const hasSentence = Number(sentence_period_value) > 0 && sentence_period_unit && sentence_start_date;
    const sentenceStatus = court_decision === 'convicted' && hasSentence ? 'serving' : 'awaiting_trial';

    const [[history]] = await db.query('SELECT COUNT(*) AS total FROM arrests WHERE suspect_id = ?', [suspect_id]);

    const [result] = await db.query(
      `INSERT INTO arrests
        (case_id, suspect_id, police_station_id, arrested_by, arrest_date, arrest_location, charges,
         court_decision, court_decision_notes, sentence_period_value, sentence_period_unit,
         sentence_start_date, expected_release_date, sentence_status,
         bail_status, bail_amount, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        case_id,
        suspect_id,
        policeStationId,
        req.user.username || req.user.id,
        arrest_date || new Date(),
        normalizeOptional(arrest_location),
        normalizeOptional(charges),
        court_decision || 'pending',
        normalizeOptional(court_decision_notes),
        normalizeOptional(sentence_period_value),
        normalizeOptional(sentence_period_unit),
        normalizeOptional(sentence_start_date),
        expectedReleaseDate,
        sentenceStatus,
        bail_status || 'no_bail',
        bail_amount || null,
        normalizeOptional(notes),
      ]
    );

    const arrestId = result.insertId;
    await db.query('UPDATE criminals SET is_arrested = 1 WHERE id = ?', [suspect_id]);
    await db.query(
      `INSERT IGNORE INTO case_criminals (case_id, criminal_id, role_in_case, notes, added_by)
       VALUES (?, ?, ?, ?, ?)`,
      [case_id, suspect_id, 'Arrested suspect', 'Automatically linked when arrest was recorded.', req.user.username || req.user.id]
    );

    const repeatMessage = Number(history.total) > 0
      ? ` Repeat offender: ${suspect.full_name} has ${history.total} previous arrest record(s).`
      : '';

    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description)
       VALUES (?, ?, ?, ?)`,
      [case_id, req.user.username || req.user.id, 'SUSPECT_ARRESTED', `Suspect ID ${suspect_id} has been arrested.${repeatMessage}`]
    );

    await writeAuditLog({
      userId: req.user.username || req.user.id,
      userEmail: req.user.email || req.user.username,
      action: 'RECORD_ARREST',
      entityType: 'arrests',
      entityId: arrestId,
      newData: { ...req.body, expected_release_date: expectedReleaseDate, repeat_offender: Number(history.total) > 0 },
    });

    res.status(201).json({
      success: true,
      message: Number(history.total) > 0
        ? 'Arrest record created and linked to previous offender history.'
        : 'Arrest record created.',
      arrestId,
      repeatOffender: Number(history.total) > 0,
      previousArrestCount: Number(history.total),
      expected_release_date: expectedReleaseDate,
    });
  } catch (err) { next(err); }
};

/** PUT /api/arrests/:id/sentence - Add or update court sentence */
const updateSentence = async (req, res, next) => {
  try {
    const arrestId = req.params.id;
    const {
      court_decision,
      court_decision_notes,
      sentence_period_value,
      sentence_period_unit,
      sentence_start_date,
      expected_release_date,
      final_status,
      notes,
    } = req.body;

    if (court_decision && !COURT_DECISIONS.has(court_decision)) {
      return res.status(400).json({ success: false, message: 'Invalid court decision.' });
    }
    if (sentence_period_unit && !SENTENCE_UNITS.has(sentence_period_unit)) {
      return res.status(400).json({ success: false, message: 'Sentence unit must be days, months, or years.' });
    }

    const [[existing]] = await db.query('SELECT * FROM arrests WHERE id = ?', [arrestId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Arrest record not found.' });

    const releaseDate = normalizeOptional(expected_release_date)
      || calculateExpectedReleaseDate(sentence_start_date, sentence_period_value, sentence_period_unit);

    let sentenceStatus = existing.sentence_status;
    if (court_decision === 'acquitted') sentenceStatus = 'acquitted';
    else if (court_decision === 'dismissed') sentenceStatus = 'dismissed';
    else if (court_decision === 'convicted' && releaseDate) sentenceStatus = 'serving';
    else if (court_decision === 'convicted') sentenceStatus = 'sentenced';

    await db.query(
      `UPDATE arrests SET
         court_decision = COALESCE(?, court_decision),
         court_decision_notes = ?,
         sentence_period_value = ?,
         sentence_period_unit = ?,
         sentence_start_date = ?,
         expected_release_date = ?,
         sentence_status = ?,
         final_status = ?,
         notes = COALESCE(?, notes)
       WHERE id = ?`,
      [
        normalizeOptional(court_decision),
        normalizeOptional(court_decision_notes),
        normalizeOptional(sentence_period_value),
        normalizeOptional(sentence_period_unit),
        normalizeOptional(sentence_start_date),
        releaseDate,
        sentenceStatus,
        normalizeOptional(final_status),
        normalizeOptional(notes),
        arrestId,
      ]
    );

    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description)
       VALUES (?, ?, ?, ?)`,
      [
        existing.case_id,
        req.user.username || req.user.id,
        'SENTENCE_UPDATED',
        `Court decision/sentence updated for arrest ${arrestId}. Expected release: ${releaseDate || 'not set'}.`,
      ]
    );

    await writeAuditLog({
      userId: req.user.username || req.user.id,
      userEmail: req.user.email || req.user.username,
      action: 'UPDATE_SENTENCE',
      entityType: 'arrests',
      entityId: parseInt(arrestId, 10),
      oldData: existing,
      newData: { ...req.body, expected_release_date: releaseDate, sentence_status: sentenceStatus },
    });

    res.json({ success: true, message: 'Sentence information updated.', expected_release_date: releaseDate, sentence_status: sentenceStatus });
  } catch (err) { next(err); }
};

/** PATCH /api/arrests/:id/status - Mark escaped/wanted/completed/released */
const updateArrestStatus = async (req, res, next) => {
  try {
    const arrestId = req.params.id;
    const { sentence_status, final_status, actual_release_date, notes } = req.body;
    if (!SENTENCE_STATUSES.has(sentence_status)) {
      return res.status(400).json({ success: false, message: 'Invalid sentence status.' });
    }

    const [[existing]] = await db.query('SELECT * FROM arrests WHERE id = ?', [arrestId]);
    if (!existing) return res.status(404).json({ success: false, message: 'Arrest record not found.' });

    const releaseDate = ['released', 'completed'].includes(sentence_status)
      ? (actual_release_date || formatDate(new Date()))
      : normalizeOptional(actual_release_date);

    await db.query(
      `UPDATE arrests
       SET sentence_status = ?, final_status = ?, actual_release_date = ?, notes = COALESCE(?, notes)
       WHERE id = ?`,
      [sentence_status, normalizeOptional(final_status), releaseDate, normalizeOptional(notes), arrestId]
    );

    const stillInCustody = ['awaiting_trial', 'sentenced', 'serving', 'release_review', 'escaped', 'wanted'].includes(sentence_status) ? 1 : 0;
    await db.query('UPDATE criminals SET is_arrested = ? WHERE id = ?', [stillInCustody, existing.suspect_id]);

    await db.query(
      `INSERT INTO case_actions (case_id, performed_by, action_type, description)
       VALUES (?, ?, ?, ?)`,
      [
        existing.case_id,
        req.user.username || req.user.id,
        'PRISONER_STATUS_UPDATED',
        `Prisoner status changed to ${sentence_status}. ${notes || ''}`.trim(),
      ]
    );

    await writeAuditLog({
      userId: req.user.username || req.user.id,
      userEmail: req.user.email || req.user.username,
      action: 'UPDATE_PRISONER_STATUS',
      entityType: 'arrests',
      entityId: parseInt(arrestId, 10),
      oldData: existing,
      newData: { sentence_status, final_status, actual_release_date: releaseDate, notes: notes || null },
    });

    res.json({ success: true, message: 'Prisoner status updated.', sentence_status, actual_release_date: releaseDate });
  } catch (err) { next(err); }
};

module.exports = { getArrests, createArrest, updateSentence, updateArrestStatus };
