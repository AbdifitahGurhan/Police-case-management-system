'use strict';

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { getOperationsDashboard } = require('../controllers/operationsDashboardController');
const { allowRoles } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authMiddleware);
router.get(
  '/',
  allowRoles(
    'admin',
    'state_admin',
    'state_commander',
    'region_admin',
    'region_commander',
    'district_admin',
    'district_commander',
    'police_station_commander'
  ),
  getOperationsDashboard
);

module.exports = router;
