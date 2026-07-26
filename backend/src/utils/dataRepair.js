// src/utils/dataRepair.js
'use strict';

const runOneTimeArrestStatusRepair = async (db) => {
  console.log('Starting one-time data repair for offender arrest status...');
  await db.query('START TRANSACTION');
  try {
    // 1. Update for criminals with active custody records
    await db.query(`
      UPDATE criminals c
      JOIN (
        SELECT suspect_id, MAX(sentence_status) as status
        FROM arrests
        WHERE sentence_status IN ('awaiting_trial', 'sentenced', 'serving', 'release_review')
        GROUP BY suspect_id
      ) a ON c.id = a.suspect_id
      SET c.is_arrested = 1,
          c.arrest_status = 'arrested'
    `);

    // 2. Update for criminals with wanted/escaped records who do not have an active serving custody record
    await db.query(`
      UPDATE criminals c
      JOIN (
        SELECT suspect_id, MAX(sentence_status) as status
        FROM arrests
        WHERE sentence_status IN ('wanted', 'escaped')
          AND suspect_id NOT IN (
            SELECT suspect_id FROM arrests WHERE sentence_status IN ('awaiting_trial', 'sentenced', 'serving', 'release_review')
          )
        GROUP BY suspect_id
      ) a ON c.id = a.suspect_id
      SET c.is_arrested = 1,
          c.arrest_status = 'wanted'
    `);

    // 3. Update for criminals with only released/completed/acquitted/dismissed records
    await db.query(`
      UPDATE criminals c
      JOIN (
        SELECT suspect_id, MAX(sentence_status) as status
        FROM arrests
        WHERE sentence_status IN ('released', 'completed', 'acquitted', 'dismissed')
          AND suspect_id NOT IN (
            SELECT suspect_id FROM arrests WHERE sentence_status IN ('awaiting_trial', 'sentenced', 'serving', 'release_review', 'wanted', 'escaped')
          )
        GROUP BY suspect_id
      ) a ON c.id = a.suspect_id
      SET c.is_arrested = 0,
          c.arrest_status = 'released'
    `);

    // 4. Update for criminals with NO arrest records at all
    await db.query(`
      UPDATE criminals
      SET is_arrested = 0,
          arrest_status = 'not_arrested'
      WHERE id NOT IN (SELECT DISTINCT suspect_id FROM arrests WHERE suspect_id IS NOT NULL)
    `);

    await db.query('COMMIT');
    console.log('✅ Offender arrest status repair completed successfully.');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('❌ Offender arrest status repair failed:', err.message);
    throw err;
  }
};

const runOneTimeOfficerAssignmentRepair = async (db) => {
  console.log('Starting officer deployment single-station integrity repair...');
  await db.query('START TRANSACTION');
  try {
    // Deactivate older active assignments for any officer having multiple active assignments
    await db.query(`
      UPDATE officer_assignments oa
      JOIN (
        SELECT officer_id, MAX(id) as max_id
        FROM officer_assignments
        WHERE is_current = 1
        GROUP BY officer_id
        HAVING COUNT(*) > 1
      ) duplicates ON oa.officer_id = duplicates.officer_id AND oa.id < duplicates.max_id
      SET oa.is_current = 0
    `);

    await db.query('COMMIT');
    console.log('✅ Officer deployment single-station integrity repair completed successfully.');
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('❌ Officer deployment repair failed:', err.message);
  }
};

module.exports = { runOneTimeArrestStatusRepair, runOneTimeOfficerAssignmentRepair };

