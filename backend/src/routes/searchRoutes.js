'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { CASE_READ_ROLES } = require('../utils/roleGroups');
const { globalSearch } = require('../controllers/searchController');

router.use(authMiddleware);
router.get('/', allowRoles(...CASE_READ_ROLES), globalSearch);

module.exports = router;
