'use strict';
const express = require('express');
const router = express.Router();
const controller = require('../controllers/officerTransferController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/', controller.transferOfficer);
router.get('/:officer_id', controller.getTransferHistory);

module.exports = router;
