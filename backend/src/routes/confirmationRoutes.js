// src/routes/confirmationRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { submitForReview, respondToConfirmation } = require('../controllers/confirmationController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Officers can submit for review
router.post('/submit', allowRoles('admin', 'officer'), submitForReview);

// Ward Commanders (or Admins) can confirm/reject
router.post('/respond', allowRoles('admin', 'ward_commander'), respondToConfirmation);

module.exports = router;
