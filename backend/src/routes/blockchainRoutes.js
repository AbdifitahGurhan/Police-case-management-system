// src/routes/blockchainRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getBlockchainRecords, verifyRecord } = require('../controllers/blockchainController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/records', getBlockchainRecords);
router.post('/verify', verifyRecord);

module.exports = router;
