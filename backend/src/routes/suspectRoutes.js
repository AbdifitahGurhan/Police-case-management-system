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

router.get('/', allowRoles(...REPORT_ROLES), getcriminals);
router.get('/sentence-alerts', allowRoles('admin', 'jail'), getSentenceAlerts);
router.get('/check-duplicate', allowRoles(...INVESTIGATION_WRITE_ROLES), checkDuplicate);
router.post('/face-search', allowRoles(...REPORT_ROLES), searchSuspectByFace);
router.post('/match-search', allowRoles(...REPORT_ROLES), searchAndMatch);
router.get('/:id/history', allowRoles(...REPORT_ROLES), getSuspectHistory);
router.get('/:id/report', allowRoles(...REPORT_ROLES), getSuspectReport);
router.get('/:id', allowRoles(...REPORT_ROLES), getSuspectById);
router.post('/', allowRoles(...INVESTIGATION_WRITE_ROLES), upload.single('photo'), createSuspect);
router.post('/:id/release', allowRoles('admin', 'jail'), releaseSuspect);
router.put('/:id', allowRoles(...INVESTIGATION_WRITE_ROLES), upload.single('photo'), updateSuspect);

module.exports = router;
