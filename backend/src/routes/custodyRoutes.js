'use strict';

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { REPORT_ROLES } = require('../utils/roleGroups');
const { loadPermissions, requirePermission } = require('../middleware/permissionMiddleware');
const {
  getCustodyProfile,
  addBiometric,
  addDocument,
  addTransfer,
  getTransferDocument,
  getCentralTransfers,
  getCentralAdmissions,
  receiveCentralTransfer,
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
const requireAnyPermission = (...permissionKeys) => async (req, res, next) => {
  const permissions = req.user?.permissions || await loadPermissions(req.user);
  req.user.permissions = permissions;
  if (permissions.includes('*') || permissionKeys.some((key) => permissions.includes(key))) return next();
  if (req.user?.role === 'jail' && permissionKeys.includes('jail.view')) return next();
  return res.status(403).json({ success: false, message: `Awoodda loo baahan yahay: ${permissionKeys.join(' ama ')}` });
};

router.use(authMiddleware);

router.get('/wanted-escaped', allowRoles(...REPORT_ROLES), getWantedEscaped);
router.get('/central/transfers', requireAnyPermission('jail.view'), getCentralTransfers);
router.get('/central/admissions', requireAnyPermission('jail.view'), getCentralAdmissions);
router.patch('/central/transfers/:id/receive', requireAnyPermission('jail.receive_transfer'), receiveCentralTransfer);
router.get('/transfers/:id/document', requirePermission('station_jail.view'), getTransferDocument);
router.get('/admissions', requirePermission('station_jail.view'), getPrisonAdmissions);
router.post('/admissions', requirePermission('station_jail.intake'), upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'commitment_warrant', maxCount: 1 },
]), admitPrisoner);
router.post('/admissions/:id/cell-assignments', requirePermission('station_jail.assign_cell'), assignPrisonCell);
router.post('/admissions/:id/roll-calls', requirePermission('station_jail.intake'), recordRollCall);
router.post('/roll-calls/bulk', requirePermission('station_jail.intake'), bulkRollCall);
router.get('/cells', requireAnyPermission('station_jail.view', 'jail.view'), getPrisonCells);
router.post('/cells', requirePermission('station_jail.assign_cell'), savePrisonCell);
router.get('/criminals/:id', requireAnyPermission('station_jail.view', 'jail.view'), getCustodyProfile);
router.post('/criminals/:id/biometrics', allowRoles(...CUSTODY_WRITE_ROLES), addBiometric);
router.post('/criminals/:id/documents', allowRoles(...CUSTODY_WRITE_ROLES), upload.single('document'), addDocument);
router.post('/criminals/:id/transfers', requirePermission('station_jail.intake'), addTransfer);
router.post('/criminals/:id/medical-records', requirePermission('jail.medical'), addMedicalRecord);
router.post('/criminals/:id/visitor-logs', requirePermission('jail.visitors'), addVisitorLog);
router.post('/criminals/:id/release-approvals', requirePermission('station_jail.intake'), requestReleaseApproval);
router.patch('/release-approvals/:id/admin-review', allowRoles('admin'), adminReviewReleaseApproval);
router.patch('/release-approvals/:id/prison-confirmation', requirePermission('jail.release_confirm'), prisonConfirmReleaseApproval);
router.patch('/release-approvals/:id/court-approval', allowRoles('court', 'admin'), courtApproveReleaseApproval);
router.post('/release-approvals/:id/certificate', allowRoles('admin', 'court', 'jail'), generateReleaseCertificate);
router.patch('/release-approvals/:id', allowRoles('admin', 'court'), reviewReleaseApproval);

module.exports = router;
