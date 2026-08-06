'use strict';
const express = require('express');
const router = express.Router();
const controller = require('../controllers/rankController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', requirePermission('ranks.manage'), controller.create);
router.put('/:id', requirePermission('ranks.manage'), controller.update);
router.delete('/:id', requirePermission('ranks.manage'), controller.delete);

module.exports = router;
