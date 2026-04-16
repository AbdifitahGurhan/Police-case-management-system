'use strict';
const express = require('express');
const router = express.Router();
const stateAdminController = require('../controllers/stateAdministrationController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', stateAdminController.getAll);
router.get('/:id', stateAdminController.getById);
router.post('/', stateAdminController.create);
router.put('/:id', stateAdminController.update);
router.delete('/:id', stateAdminController.delete);

module.exports = router;
