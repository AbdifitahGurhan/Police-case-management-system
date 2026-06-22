'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { getHierarchy, getLocationProfiles } = require('../controllers/administrationStructureController');
const { COMMANDER_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

router.get('/hierarchy', allowRoles('admin', ...COMMANDER_ROLES, 'state_admin', 'region_admin', 'district_admin'), getHierarchy);
router.get('/locations', allowRoles('admin', ...COMMANDER_ROLES, 'state_admin', 'region_admin', 'district_admin'), getLocationProfiles);

module.exports = router;
