'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { getObEntries, getObEntryById, createObEntry, convertObToCase } = require('../controllers/obEntryController');
const { COMMANDER_ROLES } = require('../utils/roleGroups');

router.use(authMiddleware);

const OB_READ_ROLES = ['admin', 'ob_staff', 'staff', 'officer', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...COMMANDER_ROLES];
const OB_WRITE_ROLES = ['admin', 'ob_staff', 'officer', 'district_admin'];
const OB_CONVERT_ROLES = ['admin', 'officer', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...COMMANDER_ROLES];

router.get('/', allowRoles(...OB_READ_ROLES), getObEntries);
router.get('/:id', allowRoles(...OB_READ_ROLES), getObEntryById);
router.post('/', allowRoles(...OB_WRITE_ROLES), createObEntry);
router.post('/:id/convert-to-case', allowRoles(...OB_CONVERT_ROLES), convertObToCase);

module.exports = router;
