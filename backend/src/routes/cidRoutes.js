'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const {
  getCidDashboard,
  getCidCases,
  syncCidCase,
  getCidCaseById,
  assignCidCase,
  acknowledgeCidCase,
  updateInvestigation,
  addCrimeScene,
  submitReport,
  reviewInvestigation,
  forwardToProsecutor,
} = require('../controllers/cidController');
const { COMMANDER_ROLES } = require('../utils/roleGroups');

const CID_READ_ROLES = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'prosecutor_liaison'];
const CID_SUPERVISOR_ROLES = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'prosecutor_liaison', ...COMMANDER_ROLES];
const CID_WRITE_ROLES = ['admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer'];

router.use(authMiddleware);

router.get('/dashboard', allowRoles(...CID_READ_ROLES), getCidDashboard);
router.get('/cases', allowRoles(...CID_READ_ROLES), getCidCases);
router.post('/cases/sync', allowRoles(...CID_SUPERVISOR_ROLES), syncCidCase);
router.get('/cases/:id', allowRoles(...CID_READ_ROLES), getCidCaseById);
router.patch('/cases/:id/assign', allowRoles(...CID_SUPERVISOR_ROLES), assignCidCase);
router.patch('/cases/:id/acknowledge', allowRoles(...CID_READ_ROLES), acknowledgeCidCase);
router.patch('/cases/:id/investigation', allowRoles(...CID_WRITE_ROLES), updateInvestigation);
router.post('/cases/:id/crime-scenes', allowRoles(...CID_WRITE_ROLES), addCrimeScene);
router.post('/cases/:id/reports', allowRoles(...CID_WRITE_ROLES), submitReport);
router.patch('/cases/:id/review', allowRoles(...CID_SUPERVISOR_ROLES), reviewInvestigation);
router.post('/cases/:id/forward-prosecutor', allowRoles(...CID_SUPERVISOR_ROLES), forwardToProsecutor);

module.exports = router;
