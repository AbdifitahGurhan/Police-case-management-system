'use strict';
const express = require('express');
const router = express.Router();
const controller = require('../controllers/rankController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', allowRoles('admin'), controller.create);
router.put('/:id', allowRoles('admin'), controller.update);
router.delete('/:id', allowRoles('admin'), controller.delete);

module.exports = router;
