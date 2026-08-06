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
const { requirePermission } = require('../middleware/permissionMiddleware');

const CID_READ_ROLES = ['admin', 'district_admin', 'investigator', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', 'prosecutor_liaison'];
const CID_SUPERVISOR_ROLES = ['admin', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'prosecutor_liaison', ...COMMANDER_ROLES];
const CID_WRITE_ROLES = ['admin', 'investigator', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer'];

router.use(authMiddleware);

router.get('/dashboard', requirePermission('cases.view'), getCidDashboard);
router.get('/cases', requirePermission('cases.view'), getCidCases);
router.post('/cases/sync', requirePermission('cases.investigate'), syncCidCase);
router.get('/cases/:id', requirePermission('cases.view'), getCidCaseById);
router.patch('/cases/:id/assign', requirePermission('cases.investigate'), assignCidCase);
router.patch('/cases/:id/acknowledge', requirePermission('cases.investigate'), acknowledgeCidCase);
router.patch('/cases/:id/investigation', requirePermission('cases.investigate'), updateInvestigation);
router.post('/cases/:id/crime-scenes', requirePermission('cases.investigate'), addCrimeScene);
router.post('/cases/:id/reports', requirePermission('cases.investigate'), submitReport);
router.patch('/cases/:id/review', requirePermission('cases.investigate'), reviewInvestigation);
router.post('/cases/:id/forward-prosecutor', requirePermission('cases.investigate'), forwardToProsecutor);

module.exports = router;
