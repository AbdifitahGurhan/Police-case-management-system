// src/routes/arrestRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getArrests, createArrest, updateSentence, updateArrestStatus } = require('../controllers/arrestController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES, INVESTIGATION_WRITE_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

router.get('/', allowRoles(...REPORT_ROLES), getArrests);
router.post('/', allowRoles(...INVESTIGATION_WRITE_ROLES), createArrest);
router.put('/:id/sentence', allowRoles('admin', 'jail'), updateSentence);
router.patch('/:id/status', allowRoles('admin', 'jail'), updateArrestStatus);

module.exports = router;
