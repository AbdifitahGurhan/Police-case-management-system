// src/routes/caseRoutes.js
'use strict';

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  getCases, getMyAssignedCases, getAssignableOfficers, getCaseById, createCase, updateCase,
  assignCaseOfficer, exportCasePackage, recordCourtDecision, getCaseStats,
  getCaseInvestigations, createCaseInvestigation, updateCaseInvestigation, returnCourtRemand
} = require('../controllers/caseController');
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { CASE_READ_ROLES, CASE_WRITE_ROLES, CASE_STATUS_ROLES } = require('../utils/roleGroups');
const { requirePermission } = require('../middleware/permissionMiddleware');

router.use(authMiddleware);

const investigationUploadDir = path.join(__dirname, '../../uploads/investigations');
if (!fs.existsSync(investigationUploadDir)) {
  fs.mkdirSync(investigationUploadDir, { recursive: true });
}

const investigationUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, investigationUploadDir),
    filename: (_req, file, cb) => {
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const safeExt = path.extname(file.originalname || '').toLowerCase();
      cb(null, `${file.fieldname}-${uniqueSuffix}${safeExt}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = new Set([
      '.jpg', '.jpeg', '.png', '.webp',
      '.mp4', '.mov', '.avi', '.webm', '.mkv',
      '.pdf', '.doc', '.docx', '.txt', '.xls', '.xlsx', '.csv', '.rtf',
    ]);
    if (!allowedExts.has(extension)) {
      const error = new Error('Faylka baaritaanka noociisa lama oggola. Soo geli sawir, video/CCTV, ama document sax ah.');
      error.status = 400;
      return cb(error);
    }
    return cb(null, true);
  },
});

router.get('/', requirePermission('cases.view'), getCases);
router.get('/stats', allowRoles(...CASE_READ_ROLES, 'officer'), getCaseStats);
router.get('/my-assigned', requirePermission('cases.view'), getMyAssignedCases);
router.get('/assignable/officers', allowRoles('admin', 'district_commander', 'police_station_commander', 'district_admin'), getAssignableOfficers);
router.get('/:id/export', requirePermission('cases.view'), exportCasePackage);
router.get('/:id/investigations', requirePermission('cases.view'), getCaseInvestigations);
router.get('/:id', requirePermission('cases.view'), getCaseById);
router.post('/', requirePermission('cases.investigate'), createCase);
router.post('/:id/investigations', requirePermission('cases.investigate'), investigationUpload.any(), createCaseInvestigation);
router.put('/:id/investigations/:investigationId', requirePermission('cases.investigate'), investigationUpload.any(), updateCaseInvestigation);
router.post('/:id/remands/:remandId/return', requirePermission('cases.investigate'), returnCourtRemand);
router.post('/:id/court-decision', allowRoles('admin', 'court'), recordCourtDecision);
router.patch('/:id/assign', allowRoles('admin', 'district_commander', 'police_station_commander', 'district_admin'), assignCaseOfficer);
router.put('/:id', requirePermission('cases.investigate'), updateCase);

module.exports = router;
