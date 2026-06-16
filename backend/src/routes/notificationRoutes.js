'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { getNotifications } = require('../controllers/notificationController');

router.use(authMiddleware);
router.get('/', getNotifications);

module.exports = router;
