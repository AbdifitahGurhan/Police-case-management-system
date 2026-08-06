'use strict';
const express = require('express');
const router = express.Router();
const regionController = require('../controllers/regionController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/', requirePermission('locations.view'), regionController.getAll);
router.get('/:id', requirePermission('locations.view'), regionController.getById);
router.post('/', requirePermission('locations.manage'), regionController.create);
router.put('/:id', requirePermission('locations.manage'), regionController.update);
router.delete('/:id', requirePermission('locations.manage'), regionController.delete);

module.exports = router;
