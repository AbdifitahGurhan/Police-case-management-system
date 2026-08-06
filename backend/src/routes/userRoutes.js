// src/routes/userRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getUsers, getUserById, createUser, updateUser, updateMyProfile, updateMyProfileImage, deleteUser, getRoles, getAssignableOfficers } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { requirePermission } = require('../middleware/permissionMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/profiles');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safeExt = path.extname(file.originalname).toLowerCase();
    cb(null, `${req.user.id}-${Date.now()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    return cb(new Error('Only image files are allowed.'));
  }
});

router.use(authMiddleware);

router.get('/', requirePermission('users.manage'), getUsers);
router.get('/roles', requirePermission('users.manage'), getRoles);
router.get('/assignable-officers', requirePermission('users.manage'), getAssignableOfficers);
router.put('/me', updateMyProfile);
router.post('/me/profile-image', upload.single('profile_image'), updateMyProfileImage);
router.get('/:id', requirePermission('users.manage'), getUserById);
router.post('/', requirePermission('users.manage'), createUser);
router.put('/:id', requirePermission('users.manage'), updateUser);
router.delete('/:id', requirePermission('users.manage'), deleteUser);

module.exports = router;
