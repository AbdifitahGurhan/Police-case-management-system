'use strict';
const router = require('express').Router();
const auth = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const controller = require('../controllers/legalPersonnelController');
router.use(auth);
router.get(
  '/options',
  allowRoles(
    'admin',
    'court',
    'court_admin',
    'court_clerk',
    'judge',
    'prosecutor',
    'prosecutor_liaison',
    'officer',
    'cid',
    'cid_director',
    'cid_supervisor',
    'cid_officer',
    'district_admin',
    'district_commander',
    'police_station_commander'
  ),
  controller.options
);
router.get('/', allowRoles('admin','court','court_admin'), controller.list);
router.post('/', allowRoles('admin','court','court_admin'), controller.create);
router.put('/:id', allowRoles('admin','court','court_admin'), controller.update);
module.exports = router;
