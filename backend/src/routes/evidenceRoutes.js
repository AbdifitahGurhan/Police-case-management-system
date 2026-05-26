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
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(authMiddleware);

router.get('/', allowRoles(...REPORT_ROLES), getEvidence);
router.get('/:id', allowRoles(...REPORT_ROLES), getEvidenceById);
router.post('/', allowRoles(...INVESTIGATION_WRITE_ROLES), upload.single('file'), createEvidence);
router.post('/:id/custody', allowRoles(...INVESTIGATION_WRITE_ROLES), addCustodyTransfer);

module.exports = router;
