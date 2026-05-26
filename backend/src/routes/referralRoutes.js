// src/routes/referralRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getReferrals, createReferral, respondToReferral } = require('../controllers/referralController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES, LEGAL_WRITE_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

router.get('/', allowRoles(...REPORT_ROLES), getReferrals);
router.post('/', allowRoles(...LEGAL_WRITE_ROLES), createReferral);
router.put('/:id/respond', allowRoles('admin', 'cid'), respondToReferral);

module.exports = router;
