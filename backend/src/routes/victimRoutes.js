// src/routes/victimRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getVictims, createVictim } = require('../controllers/victimController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES, INVESTIGATION_WRITE_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

router.get('/', allowRoles(...REPORT_ROLES), getVictims);
router.post('/', allowRoles(...INVESTIGATION_WRITE_ROLES), createVictim);

module.exports = router;
