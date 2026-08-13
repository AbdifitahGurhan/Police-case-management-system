// src/routes/stationRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getStations, getStationOverview, getStationById, createStation, updateStation, deleteStation, getGeography } = require('../controllers/stationController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/', requirePermission('stations.view'), getStations);
router.get('/geography', requirePermission('stations.view'), getGeography);
router.get('/:id/overview', requirePermission('stations.view'), getStationOverview);
router.get('/:id', requirePermission('stations.view'), getStationById);
router.post('/', requirePermission('stations.manage'), createStation);
router.put('/:id', requirePermission('stations.manage'), updateStation);
router.delete('/:id', requirePermission('stations.manage'), deleteStation);

module.exports = router;
