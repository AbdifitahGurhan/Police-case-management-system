'use strict';

const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { getDistrictOperations, saveAttendance, createComplaint, updateComplaint } = require('../controllers/districtOperationsController');

const router = express.Router();
const roles = ['admin', 'district_admin', 'district_commander', 'police_station_commander'];

router.use(authMiddleware);
router.get('/', allowRoles(...roles), getDistrictOperations);
router.post('/attendance', allowRoles(...roles), saveAttendance);
router.post('/complaints', allowRoles(...roles), createComplaint);
router.patch('/complaints/:id', allowRoles(...roles), updateComplaint);

module.exports = router;
