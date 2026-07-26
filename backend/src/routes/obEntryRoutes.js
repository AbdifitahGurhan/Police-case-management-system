'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { allowRoles } = require('../middleware/roleMiddleware');
const { getObEntries, getObEntryById, createObEntry, convertObToCase, resolveObEntry, reopenObEntry, getResolutionDocument } = require('../controllers/obEntryController');
const { COMMANDER_ROLES } = require('../utils/roleGroups');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(authMiddleware);

const OB_READ_ROLES = ['admin', 'ob_staff', 'staff', 'officer', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...COMMANDER_ROLES];
const OB_WRITE_ROLES = ['admin', 'ob_staff', 'officer', 'district_admin', ...COMMANDER_ROLES];
const OB_CONVERT_ROLES = ['admin', 'officer', 'district_admin', 'cid', 'cid_director', 'cid_supervisor', 'cid_officer', ...COMMANDER_ROLES];
const uploadDir = path.join(__dirname, '../../uploads/ob');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: uploadDir, filename: (req,file,cb)=>cb(null,`${Date.now()}-${Math.round(Math.random()*1e9)}${path.extname(file.originalname)}`) }),
  limits: { fileSize: 10 * 1024 * 1024, files: 10 },
  fileFilter: (req,file,cb) => cb(null, file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')),
});

const handleUpload = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    return upload.any()(req, res, next);
  }
  next();
};

router.get('/', allowRoles(...OB_READ_ROLES), getObEntries);
router.get('/:id', allowRoles(...OB_READ_ROLES), getObEntryById);
router.post('/', allowRoles(...OB_WRITE_ROLES), handleUpload, createObEntry);
router.post('/:id/convert-to-case', allowRoles(...OB_CONVERT_ROLES), convertObToCase);
router.post('/:id/resolve', allowRoles(...OB_WRITE_ROLES), resolveObEntry);
router.post('/:id/reopen', allowRoles(...OB_WRITE_ROLES), reopenObEntry);
router.get('/:id/resolution-documents/:documentId', allowRoles(...OB_READ_ROLES), getResolutionDocument);

module.exports = router;
