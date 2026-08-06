'use strict';
const express = require('express');
const router = express.Router();
const controller = require('../controllers/policeOfficerController');
const authMiddleware = require('../middleware/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { requirePermission } = require('../middleware/permissionMiddleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/officers');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const isExtAllowed = allowedExts.includes(ext);
    const isMimeAllowed = file.mimetype ? file.mimetype.startsWith('image/') : false;

    if (isExtAllowed && isMimeAllowed) {
      return cb(null, true);
    }
    const err = new Error('Faylka la soo geliyay waa inuu sawir yahay (.jpg, .jpeg, .png, .webp, .gif)');
    err.status = 400;
    return cb(err);
  }
});

router.use(authMiddleware);

router.get('/deployed', requirePermission('officers.view'), controller.getDeployedOfficers);
router.get('/', requirePermission('officers.view'), controller.getAll);
router.get('/:id', requirePermission('officers.view'), controller.getById);
router.post('/', requirePermission('officers.create'), upload.single('profile_image'), controller.create);
router.post('/:id/review', requirePermission('officers.approve'), controller.reviewApproval);
router.put('/:id', requirePermission('officers.update'), upload.single('profile_image'), controller.update);
router.delete('/:id', requirePermission('officers.delete'), controller.delete);

module.exports = router;
