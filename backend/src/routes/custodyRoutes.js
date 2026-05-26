'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES } = require('../utils/roleGroups');
const {
  getCustodyProfile,
  addBiometric,
  addDocument,
  addTransfer,
  addMedicalRecord,
  addVisitorLog,
  requestReleaseApproval,
  adminReviewReleaseApproval,
  prisonConfirmReleaseApproval,
  courtApproveReleaseApproval,
  generateReleaseCertificate,
  reviewReleaseApproval,
  getWantedEscaped,
} = require('../controllers/custodyController');

const uploadDir = path.join(__dirname, '../../uploads/prisoner-documents');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
const CUSTODY_WRITE_ROLES = ['admin', 'jail', 'court', 'cid'];

router.use(authMiddleware);

router.get('/wanted-escaped', allowRoles(...REPORT_ROLES), getWantedEscaped);
router.get('/suspects/:id', allowRoles(...REPORT_ROLES), getCustodyProfile);
router.post('/suspects/:id/biometrics', allowRoles(...CUSTODY_WRITE_ROLES), addBiometric);
router.post('/suspects/:id/documents', allowRoles(...CUSTODY_WRITE_ROLES), upload.single('document'), addDocument);
router.post('/suspects/:id/transfers', allowRoles('admin', 'jail'), addTransfer);
router.post('/suspects/:id/medical-records', allowRoles('admin', 'jail'), addMedicalRecord);
router.post('/suspects/:id/visitor-logs', allowRoles('admin', 'jail'), addVisitorLog);
router.post('/suspects/:id/release-approvals', allowRoles('admin', 'jail'), requestReleaseApproval);
router.patch('/release-approvals/:id/admin-review', allowRoles('admin'), adminReviewReleaseApproval);
router.patch('/release-approvals/:id/prison-confirmation', allowRoles('jail'), prisonConfirmReleaseApproval);
router.patch('/release-approvals/:id/court-approval', allowRoles('court', 'admin'), courtApproveReleaseApproval);
router.post('/release-approvals/:id/certificate', allowRoles('admin', 'court', 'jail'), generateReleaseCertificate);
router.patch('/release-approvals/:id', allowRoles('admin', 'court'), reviewReleaseApproval);

module.exports = router;
