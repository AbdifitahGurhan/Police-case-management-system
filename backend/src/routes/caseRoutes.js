// src/routes/caseRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getCases, getMyAssignedCases, getAssignableOfficers, getCaseById, createCase, updateCase, assignCaseOfficer, exportCasePackage, recordCourtDecision, getCaseStats } = require('../controllers/caseController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { CASE_READ_ROLES, CASE_WRITE_ROLES, CASE_STATUS_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

router.get('/', allowRoles(...CASE_READ_ROLES), getCases);
router.get('/stats', allowRoles(...CASE_READ_ROLES), getCaseStats);
router.get('/my-assigned', allowRoles(...CASE_READ_ROLES), getMyAssignedCases);
router.get('/assignable/officers', allowRoles('admin', 'district_commander', 'police_station_commander', 'district_admin'), getAssignableOfficers);
router.get('/:id/export', allowRoles(...CASE_READ_ROLES), exportCasePackage);
router.get('/:id', allowRoles(...CASE_READ_ROLES), getCaseById);
router.post('/', allowRoles(...CASE_WRITE_ROLES), createCase);
router.post('/:id/court-decision', allowRoles('admin', 'court'), recordCourtDecision);
router.patch('/:id/assign', allowRoles('admin', 'district_commander', 'police_station_commander', 'district_admin'), assignCaseOfficer);
router.put('/:id', allowRoles(...CASE_STATUS_ROLES), updateCase);

module.exports = router;
