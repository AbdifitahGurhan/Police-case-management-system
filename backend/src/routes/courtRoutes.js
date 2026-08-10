'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { COURT_READ_ROLES, COURT_ADMIN_ROLES, COURT_WRITE_ROLES } = require('../utils/roleGroups');
const {
  getCourtDashboard,
  getCourtPersonnel,
  getCourtCases,
  getCourtCaseById,
  getCourtCalendar,
  getCourtNotifications,
  syncCourtCase,
  recordArraignment,
  getCourtRemands,
  orderRemandInvestigation,
  assignCourtCase,
  scheduleHearing,
  updateHearing,
  addProceeding,
  completeEvidenceDefense,
  saveJudgment,
  issueSentence,
  registerAppeal,
  updateCourtWitness,
  decideAppeal,
  closeCourtCase,
} = require('../controllers/courtController');

router.use(authMiddleware);

router.get('/dashboard', allowRoles(...COURT_READ_ROLES), getCourtDashboard);
router.get('/personnel', allowRoles(...COURT_READ_ROLES), getCourtPersonnel);
router.get('/calendar', allowRoles(...COURT_READ_ROLES), getCourtCalendar);
router.get('/notifications', allowRoles(...COURT_READ_ROLES), getCourtNotifications);
router.get('/cases', allowRoles(...COURT_READ_ROLES), getCourtCases);
router.post('/cases/sync', allowRoles(...COURT_ADMIN_ROLES), syncCourtCase);
router.get('/cases/:id', allowRoles(...COURT_READ_ROLES), getCourtCaseById);
router.post('/cases/:id/arraignment', allowRoles(...COURT_ADMIN_ROLES, 'judge', 'court_clerk'), recordArraignment);
router.get('/cases/:id/remands', allowRoles(...COURT_READ_ROLES), getCourtRemands);
router.post('/cases/:id/remands', allowRoles(...COURT_ADMIN_ROLES, 'judge'), orderRemandInvestigation);
router.patch('/cases/:id/assign', allowRoles(...COURT_ADMIN_ROLES), assignCourtCase);
router.post('/cases/:id/hearings', allowRoles(...COURT_WRITE_ROLES), scheduleHearing);
router.patch('/hearings/:hearingId', allowRoles(...COURT_WRITE_ROLES), updateHearing);
router.post('/hearings/:hearingId/proceedings', allowRoles(...COURT_WRITE_ROLES), addProceeding);
router.post('/cases/:id/evidence-defense', allowRoles(...COURT_WRITE_ROLES, 'judge'), completeEvidenceDefense);
router.post('/cases/:id/judgments', allowRoles(...COURT_ADMIN_ROLES, 'judge'), saveJudgment);
router.post('/cases/:id/sentences', allowRoles(...COURT_ADMIN_ROLES, 'judge'), issueSentence);
router.post('/cases/:id/appeals', allowRoles(...COURT_WRITE_ROLES), registerAppeal);
router.patch('/cases/:id/witnesses/:witnessId', allowRoles(...COURT_WRITE_ROLES), updateCourtWitness);
router.patch('/appeals/:appealId/decision', allowRoles(...COURT_ADMIN_ROLES, 'judge'), decideAppeal);
router.patch('/cases/:id/close', allowRoles(...COURT_ADMIN_ROLES), closeCourtCase);

module.exports = router;
