// src/routes/suspectRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getSuspects, getSuspectById, createSuspect, updateSuspect } = require('../controllers/suspectController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getSuspects);
router.get('/:id', getSuspectById);
router.post('/', createSuspect);
router.put('/:id', updateSuspect);

module.exports = router;
