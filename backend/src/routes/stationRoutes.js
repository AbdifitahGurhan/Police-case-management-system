// src/routes/stationRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getStations, getStationById, createStation, updateStation, deleteStation, getGeography } = require('../controllers/stationController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', getStations);
router.get('/geography', getGeography);
router.get('/:id', getStationById);
router.post('/', allowRoles('admin'), createStation);
router.put('/:id', allowRoles('admin'), updateStation);
router.delete('/:id', allowRoles('admin'), deleteStation);

module.exports = router;
