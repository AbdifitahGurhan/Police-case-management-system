// src/routes/referralRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getReferrals, createReferral, respondToReferral } = require('../controllers/referralController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getReferrals);
router.post('/', createReferral);
router.put('/:id/respond', respondToReferral);

module.exports = router;
