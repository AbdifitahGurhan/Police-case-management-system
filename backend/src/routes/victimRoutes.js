// src/routes/victimRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getVictims, createVictim } = require('../controllers/victimController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getVictims);
router.post('/', createVictim);

module.exports = router;
