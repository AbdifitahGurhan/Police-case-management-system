'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES } = require('../utils/roleGroups');
const { requirePermission } = require('../middleware/permissionMiddleware');
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
  getPrisonAdmissions,
  admitPrisoner,
  assignPrisonCell,
  recordRollCall,
  getPrisonCells,
  savePrisonCell,
  bulkRollCall,
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
router.get('/admissions', requirePermission('station_jail.view'), getPrisonAdmissions);
router.post('/admissions', requirePermission('station_jail.intake'), upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'commitment_warrant', maxCount: 1 },
]), admitPrisoner);
router.post('/admissions/:id/cell-assignments', requirePermission('station_jail.assign_cell'), assignPrisonCell);
router.post('/admissions/:id/roll-calls', requirePermission('station_jail.intake'), recordRollCall);
router.post('/roll-calls/bulk', requirePermission('station_jail.intake'), bulkRollCall);
router.get('/cells', requirePermission('station_jail.view'), getPrisonCells);
router.post('/cells', requirePermission('station_jail.assign_cell'), savePrisonCell);
router.get('/criminals/:id', allowRoles(...REPORT_ROLES), getCustodyProfile);
router.post('/criminals/:id/biometrics', allowRoles(...CUSTODY_WRITE_ROLES), addBiometric);
router.post('/criminals/:id/documents', allowRoles(...CUSTODY_WRITE_ROLES), upload.single('document'), addDocument);
router.post('/criminals/:id/transfers', requirePermission('station_jail.intake'), addTransfer);
router.post('/criminals/:id/medical-records', allowRoles('admin', 'jail'), addMedicalRecord);
router.post('/criminals/:id/visitor-logs', allowRoles('admin', 'jail'), addVisitorLog);
router.post('/criminals/:id/release-approvals', requirePermission('station_jail.intake'), requestReleaseApproval);
router.patch('/release-approvals/:id/admin-review', allowRoles('admin'), adminReviewReleaseApproval);
router.patch('/release-approvals/:id/prison-confirmation', requirePermission('station_jail.intake'), prisonConfirmReleaseApproval);
router.patch('/release-approvals/:id/court-approval', allowRoles('court', 'admin'), courtApproveReleaseApproval);
router.post('/release-approvals/:id/certificate', allowRoles('admin', 'court', 'jail'), generateReleaseCertificate);
router.patch('/release-approvals/:id', allowRoles('admin', 'court'), reviewReleaseApproval);

module.exports = router;
