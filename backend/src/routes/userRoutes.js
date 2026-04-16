// src/routes/userRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const { getUsers, getUserById, createUser, updateUser, deleteUser, getRoles } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

router.use(authMiddleware);

router.get('/', allowRoles('admin'), getUsers);
router.get('/roles', allowRoles('admin'), getRoles);
router.get('/:id', allowRoles('admin'), getUserById);
router.post('/', allowRoles('admin'), createUser);
router.put('/:id', allowRoles('admin'), updateUser);
router.delete('/:id', allowRoles('admin'), deleteUser);

module.exports = router;
