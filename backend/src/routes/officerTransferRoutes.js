'use strict';
const express = require('express');
const router = express.Router();
const controller = require('../controllers/officerTransferController');
const authMiddleware = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

router.post('/', requirePermission('officers.transfer'), controller.transferOfficer);
router.get('/:officer_id', requirePermission('officers.view'), controller.getTransferHistory);

module.exports = router;
