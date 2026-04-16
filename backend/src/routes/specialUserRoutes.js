'use strict';

const express = require('express');
const router = express.Router();
const specialUserController = require('../controllers/specialUserController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

// All endpoints require auth
router.use(authMiddleware);

// Only Admins can manage special users
router.use(allowRoles('admin'));

router.get('/', specialUserController.getSpecialUsers);
router.get('/:id', specialUserController.getSpecialUserById);
router.post('/', specialUserController.createSpecialUser);
router.put('/:id', specialUserController.updateSpecialUser);
router.delete('/:id', specialUserController.deleteSpecialUser);

module.exports = router;
