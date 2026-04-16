// src/routes/caseRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getCases, getCaseById, createCase, updateCase, getCaseStats } = require('../controllers/caseController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', getCases);
router.get('/stats', getCaseStats);
router.get('/:id', getCaseById);
router.post('/', allowRoles('admin', 'officer'), createCase);
router.put('/:id', allowRoles('admin', 'officer', 'cid', 'prosecutor'), updateCase);

module.exports = router;
