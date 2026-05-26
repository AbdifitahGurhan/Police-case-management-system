// src/routes/confirmationRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { submitForReview, respondToConfirmation } = require('../controllers/confirmationController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { CASE_WRITE_ROLES, COMMAND_REVIEW_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

// Officers can submit for review
router.post('/submit', allowRoles(...CASE_WRITE_ROLES), submitForReview);

// Ward Commanders (or Admins) can confirm/reject
router.post('/respond', allowRoles(...COMMAND_REVIEW_ROLES), respondToConfirmation);

module.exports = router;
