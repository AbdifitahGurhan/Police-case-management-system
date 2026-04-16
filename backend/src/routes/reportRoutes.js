// src/routes/reportRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getAuditLogs, getSummaryReport, getCasesByStation } = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/audit-logs', allowRoles('admin', 'officer', 'cid', 'prosecutor'), getAuditLogs);
router.get('/summary', allowRoles('admin', 'officer', 'cid', 'prosecutor', 'state_admin', 'region_admin', 'city_admin', 'district_admin', 'neighborhood_admin'), getSummaryReport);
router.get('/by-station', allowRoles('admin', 'officer', 'cid', 'prosecutor'), getCasesByStation);
router.get('/unit-dashboard', allowRoles('state_admin', 'region_admin', 'city_admin', 'district_admin', 'neighborhood_admin'), require('../controllers/reportController').getUnitDashboardStats);

module.exports = router;
