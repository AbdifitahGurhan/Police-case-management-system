// src/routes/userRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getUsers, getUserById, createUser, updateUser, updateMyProfile, updateMyProfileImage, deleteUser, getRoles } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');

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

router.get('/', allowRoles('admin', 'region_admin'), getUsers);
router.get('/roles', allowRoles('admin', 'region_admin'), getRoles);
router.put('/me', updateMyProfile);
router.post('/me/profile-image', upload.single('profile_image'), updateMyProfileImage);
router.get('/:id', allowRoles('admin', 'region_admin'), getUserById);
router.post('/', allowRoles('admin', 'region_admin'), createUser);
router.put('/:id', allowRoles('admin', 'region_admin'), updateUser);
router.delete('/:id', allowRoles('admin', 'region_admin'), deleteUser);

module.exports = router;
