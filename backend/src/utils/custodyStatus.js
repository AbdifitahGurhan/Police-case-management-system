// src/utils/custodyStatus.js — Single source of truth for a person's custody status/location.
// The `arrests` table is the custody record. criminals.is_arrested/arrest_status are a
// denormalized cache of whatever the suspect's LATEST arrest record says, and must only ever
// be recomputed from that latest record — never from whichever arrest row a caller happens
// to be editing.
'use strict';

const CUSTODY_ACTIVE_STATUSES = ['awaiting_trial', 'sentenced', 'serving', 'release_review'];
const WANTED_STATUSES = ['wanted', 'escaped'];

const deriveCustodyFromSentenceStatus = (sentenceStatus) => {
  if (WANTED_STATUSES.includes(sentenceStatus)) return { isArrested: 0, arrestStatus: 'wanted' };
  if (CUSTODY_ACTIVE_STATUSES.includes(sentenceStatus)) return { isArrested: 1, arrestStatus: 'arrested' };
  return { isArrested: 0, arrestStatus: 'released' };
};

/**
 * Recompute and persist criminals.is_arrested/arrest_status from the suspect's single
 * latest arrest record (by arrest_date, tied broken by id). Must be called with the same
 * transactional `connection` used for the write that triggered it (arrest/release/sentence
 * update/certificate), so the criminals row and the arrests row commit or roll back together.
 */
const syncCriminalCustodyStatus = async (connection, suspectId) => {
  const [[latestArrest]] = await connection.query(
    'SELECT id, sentence_status FROM arrests WHERE suspect_id = ? ORDER BY arrest_date DESC, id DESC LIMIT 1',
    [suspectId]
  );

  // No arrest record at all — there is nothing to be "in custody" from.
  const { isArrested, arrestStatus } = latestArrest
    ? deriveCustodyFromSentenceStatus(latestArrest.sentence_status)
    : { isArrested: 0, arrestStatus: 'not_arrested' };

  await connection.query('UPDATE criminals SET is_arrested = ?, arrest_status = ? WHERE id = ?', [isArrested, arrestStatus, suspectId]);
  return { isArrested, arrestStatus, latestArrest: latestArrest || null };
};

module.exports = {
  CUSTODY_ACTIVE_STATUSES,
  WANTED_STATUSES,
  deriveCustodyFromSentenceStatus,
  syncCriminalCustodyStatus,
};
