// src/routes/witnessRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getWitnesses, createWitnessAndStatement } = require('../controllers/witnessController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES, LEGAL_WRITE_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

router.get('/', allowRoles(...REPORT_ROLES), getWitnesses);
router.post('/', allowRoles(...LEGAL_WRITE_ROLES), createWitnessAndStatement);

module.exports = router;
