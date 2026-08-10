// src/routes/suspectRoutes.js
'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const {
  getcriminals,
  getSuspectById,
  getSuspectHistory,
  getSuspectReport,
  getSentenceAlerts,
  searchSuspectByFace,
  searchAndMatch,
  createSuspect,
  updateSuspect,
  releaseSuspect,
  checkDuplicate,
} = require('../controllers/suspectController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES, INVESTIGATION_WRITE_ROLES } = require('../utils/roleGroups');
const { requirePermission } = require('../middleware/permissionMiddleware');

const offenderUploadDir = path.join(__dirname, '../../uploads/offenders');
if (!fs.existsSync(offenderUploadDir)) {
  fs.mkdirSync(offenderUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, offenderUploadDir),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and WEBP offender photos are allowed.'));
    }
    cb(null, true);
  },
});

router.use(authMiddleware);

router.get('/', requirePermission('suspects.view'), getcriminals);
router.get('/sentence-alerts', allowRoles('admin', 'jail'), getSentenceAlerts);
router.get('/check-duplicate', requirePermission('suspects.view'), checkDuplicate);
router.post('/face-search', requirePermission('suspects.view'), searchSuspectByFace);
router.post('/match-search', requirePermission('suspects.view'), searchAndMatch);
router.get('/:id/history', requirePermission('suspects.view'), getSuspectHistory);
router.get('/:id/report', requirePermission('suspects.view'), getSuspectReport);
router.get('/:id', requirePermission('suspects.view'), getSuspectById);
router.post('/', requirePermission('suspects.create'), upload.single('photo'), createSuspect);
router.post('/:id/release', allowRoles('admin', 'jail'), releaseSuspect);
router.put('/:id', requirePermission('suspects.update'), upload.single('photo'), updateSuspect);

module.exports = router;
