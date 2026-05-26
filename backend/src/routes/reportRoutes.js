// src/routes/reportRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const {
  getAuditLogs,
  getSummaryReport,
  getCasesByStation,
  getStationFullReport,
  getRegionDashboardStats,
  getOffenderProfileReport,
  getMonthlyCrimeReport,
  getRepeatOffenderReport,
  getStationPerformanceReport,
  getCrimeCategoryReport,
  getCustodyDashboardReport,
  getCustodyAnalyticsReport,
} = require('../controllers/reportController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES, UNIT_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

router.get('/audit-logs', allowRoles(...REPORT_ROLES), getAuditLogs);
router.get('/summary', allowRoles(...REPORT_ROLES, ...UNIT_ROLES), getSummaryReport);
router.get('/by-station', allowRoles(...REPORT_ROLES), getCasesByStation);
router.get('/station-full', allowRoles(...REPORT_ROLES), getStationFullReport);
router.get('/unit-dashboard', allowRoles(...UNIT_ROLES), require('../controllers/reportController').getUnitDashboardStats);
router.get('/region-dashboard', allowRoles('admin', 'region_admin'), getRegionDashboardStats);
router.get('/offender-profile', allowRoles(...REPORT_ROLES), getOffenderProfileReport);
router.get('/monthly-crime', allowRoles(...REPORT_ROLES), getMonthlyCrimeReport);
router.get('/repeat-offenders', allowRoles(...REPORT_ROLES), getRepeatOffenderReport);
router.get('/station-performance', allowRoles(...REPORT_ROLES), getStationPerformanceReport);
router.get('/crime-category', allowRoles(...REPORT_ROLES), getCrimeCategoryReport);
router.get('/custody-dashboard', allowRoles(...REPORT_ROLES), getCustodyDashboardReport);
router.get('/custody-analytics', allowRoles(...REPORT_ROLES), getCustodyAnalyticsReport);

module.exports = router;
