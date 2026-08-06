'use strict';

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { getDistrictOperations, saveAttendance, createComplaint, updateComplaint } = require('../controllers/districtOperationsController');
const { requirePermission } = require('../middleware/permissionMiddleware');

const router = express.Router();
const roles = ['admin', 'district_admin', 'district_commander', 'police_station_commander'];

router.use(authMiddleware);
router.get('/', requirePermission('cases.view'), getDistrictOperations);
router.post('/attendance', requirePermission('officers.update'), saveAttendance);
router.post('/complaints', requirePermission('cases.investigate'), createComplaint);
router.patch('/complaints/:id', requirePermission('cases.investigate'), updateComplaint);

module.exports = router;
