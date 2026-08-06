'use strict';
const express = require('express');
const router = express.Router();
const controller = require('../controllers/districtController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/', requirePermission('locations.view'), controller.getAll);
router.get('/:id', requirePermission('locations.view'), controller.getById);
router.post('/', requirePermission('locations.manage'), controller.create);
router.put('/:id', requirePermission('locations.manage'), controller.update);
router.delete('/:id', requirePermission('locations.manage'), controller.delete);

module.exports = router;
