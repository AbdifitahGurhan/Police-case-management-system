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
  assignCourtCase,
  scheduleHearing,
  updateHearing,
  addProceeding,
  saveJudgment,
  issueSentence,
  registerAppeal,
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
router.patch('/cases/:id/assign', allowRoles(...COURT_ADMIN_ROLES), assignCourtCase);
router.post('/cases/:id/hearings', allowRoles(...COURT_WRITE_ROLES), scheduleHearing);
router.patch('/hearings/:hearingId', allowRoles(...COURT_WRITE_ROLES), updateHearing);
router.post('/hearings/:hearingId/proceedings', allowRoles(...COURT_WRITE_ROLES), addProceeding);
router.post('/cases/:id/judgments', allowRoles(...COURT_ADMIN_ROLES), saveJudgment);
router.post('/cases/:id/sentences', allowRoles(...COURT_ADMIN_ROLES), issueSentence);
router.post('/cases/:id/appeals', allowRoles(...COURT_WRITE_ROLES), registerAppeal);
router.patch('/cases/:id/close', allowRoles(...COURT_ADMIN_ROLES), closeCourtCase);

module.exports = router;
