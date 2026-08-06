'use strict';
const express = require('express');
const router = express.Router();
const stateAdminController = require('../controllers/stateAdministrationController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/', requirePermission('locations.view'), stateAdminController.getAll);
router.get('/:id', requirePermission('locations.view'), stateAdminController.getById);
router.post('/', requirePermission('locations.manage'), stateAdminController.create);
router.put('/:id', requirePermission('locations.manage'), stateAdminController.update);
router.delete('/:id', requirePermission('locations.manage'), stateAdminController.delete);

module.exports = router;
