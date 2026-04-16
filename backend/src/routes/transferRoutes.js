// src/routes/transferRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { transferCase, getTransferHistory } = require('../controllers/transferController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

// Admins and Ward Commanders can perform transfers
router.post('/', allowRoles('admin', 'ward_commander'), transferCase);

// History can be viewed by anyone authorized for cases
router.get('/history/:caseId', getTransferHistory);

module.exports = router;
