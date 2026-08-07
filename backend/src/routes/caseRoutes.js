// src/routes/caseRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const {
  getCases, getMyAssignedCases, getAssignableOfficers, getCaseById, createCase, updateCase,
  assignCaseOfficer, exportCasePackage, recordCourtDecision, getCaseStats,
  getCaseInvestigations, createCaseInvestigation
} = require('../controllers/caseController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { CASE_READ_ROLES, CASE_WRITE_ROLES, CASE_STATUS_ROLES } = require('../utils/roleGroups');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/', requirePermission('cases.view'), getCases);
router.get('/stats', allowRoles(...CASE_READ_ROLES, 'officer'), getCaseStats);
router.get('/my-assigned', requirePermission('cases.view'), getMyAssignedCases);
router.get('/assignable/officers', allowRoles('admin', 'district_commander', 'police_station_commander', 'district_admin'), getAssignableOfficers);
router.get('/:id/export', requirePermission('cases.view'), exportCasePackage);
router.get('/:id/investigations', requirePermission('cases.view'), getCaseInvestigations);
router.get('/:id', requirePermission('cases.view'), getCaseById);
router.post('/', requirePermission('cases.investigate'), createCase);
router.post('/:id/investigations', requirePermission('cases.investigate'), createCaseInvestigation);
router.post('/:id/court-decision', allowRoles('admin', 'court'), recordCourtDecision);
router.patch('/:id/assign', allowRoles('admin', 'district_commander', 'police_station_commander', 'district_admin'), assignCaseOfficer);
router.put('/:id', requirePermission('cases.investigate'), updateCase);

module.exports = router;
