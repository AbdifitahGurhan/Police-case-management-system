// src/routes/transferRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { transferCase, getTransferHistory } = require('../controllers/transferController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { CASE_READ_ROLES, COMMAND_REVIEW_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

// Admins and Ward Commanders can perform transfers
router.post('/', allowRoles(...COMMAND_REVIEW_ROLES), transferCase);

// History can be viewed by anyone authorized for cases
router.get('/history/:caseId', allowRoles(...CASE_READ_ROLES), getTransferHistory);

module.exports = router;
