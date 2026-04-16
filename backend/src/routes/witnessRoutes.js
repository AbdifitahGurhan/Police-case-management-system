// src/routes/witnessRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getWitnesses, createWitnessAndStatement } = require('../controllers/witnessController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getWitnesses);
router.post('/', createWitnessAndStatement);

module.exports = router;
