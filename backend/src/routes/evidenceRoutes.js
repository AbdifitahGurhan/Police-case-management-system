// src/routes/evidenceRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getEvidence, getEvidenceById, createEvidence, addCustodyTransfer } = require('../controllers/evidenceController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES, INVESTIGATION_WRITE_ROLES } = require('../utils/roleGroups');
const { requirePermission } = require('../middleware/permissionMiddleware');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const type = (req.body?.type || 'document').toLowerCase();

    if (type === 'document') {
      const allowedDocExts = new Set(['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.csv', '.rtf']);
      if (!allowedDocExts.has(extension)) {
        const error = new Error('Nooca caddeynta ee Dokumiintiga ah wuxuu ogol yahay oo keliya faylasha PDF, DOC, DOCX, TXT, XLS, XLSX. Ma ogola fiidiyow ama sawir.');
        error.status = 400;
        return cb(error);
      }
    } else if (type === 'photo' || type === 'image') {
      const allowedPhotoExts = new Set(['.jpg', '.jpeg', '.png', '.webp']);
      if (!allowedPhotoExts.has(extension)) {
        const error = new Error('Nooca caddeynta ee Sawirka ah wuxuu ogol yahay oo keliya JPG, JPEG, PNG, ama WEBP.');
        error.status = 400;
        return cb(error);
      }
    } else if (type === 'video') {
      const allowedVideoExts = new Set(['.mp4', '.mov', '.avi', '.webm', '.mkv']);
      if (!allowedVideoExts.has(extension)) {
        const error = new Error('Nooca caddeynta ee Fiidiyowga ah wuxuu ogol yahay oo keliya MP4, MOV, AVI, ama WEBM.');
        error.status = 400;
        return cb(error);
      }
    } else {
      const allowedGeneralExts = new Set(['.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.jpg', '.jpeg', '.png', '.webp', '.mp4', '.zip', '.rar']);
      if (!allowedGeneralExts.has(extension)) {
        const error = new Error('Faylka caddeynta noocan ah la ma ogola.');
        error.status = 400;
        return cb(error);
      }
    }
    return cb(null, true);
  },
});

router.use(authMiddleware);

router.get('/', requirePermission('cases.view'), getEvidence);
router.get('/:id', requirePermission('cases.view'), getEvidenceById);
router.post('/', requirePermission('evidence.manage'), upload.single('file'), createEvidence);
router.post('/:id/custody', requirePermission('evidence.manage'), addCustodyTransfer);

module.exports = router;
