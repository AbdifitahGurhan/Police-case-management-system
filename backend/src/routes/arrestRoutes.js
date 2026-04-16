// src/routes/arrestRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getArrests, createArrest } = require('../controllers/arrestController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', allowRoles('admin', 'officer', 'cid', 'prosecutor'), getArrests);
router.post('/', allowRoles('admin', 'officer', 'cid'), createArrest);

module.exports = router;
