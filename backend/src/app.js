// src/app.js - Main Express entry point
'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { getAllowedOrigins, isProduction, port, uploadDir, validateEnv } = require('./config/env');
validateEnv();

const { testConnection } = require('./config/database');
const { connectMongoDB } = require('./config/mongodb');
const { runOneTimeArrestStatusRepair, runOneTimeOfficerAssignmentRepair } = require('./utils/dataRepair');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const stateAdministrationRoutes = require('./routes/stateAdministrationRoutes');
const regionRoutes = require('./routes/regionRoutes');
const districtRoutes = require('./routes/districtRoutes');
const rankRoutes = require('./routes/rankRoutes');
const policeOfficerRoutes = require('./routes/policeOfficerRoutes');
const caseRoutes = require('./routes/caseRoutes');
const evidenceRoutes = require('./routes/evidenceRoutes');
const suspectRoutes = require('./routes/suspectRoutes');
const victimRoutes = require('./routes/victimRoutes');
const witnessRoutes = require('./routes/witnessRoutes');
const referralRoutes = require('./routes/referralRoutes');
const blockchainRoutes = require('./routes/blockchainRoutes');
const reportRoutes = require('./routes/reportRoutes');
const arrestRoutes = require('./routes/arrestRoutes');
const confirmationRoutes = require('./routes/confirmationRoutes');
const transferRoutes = require('./routes/transferRoutes');
const officerTransferRoutes = require('./routes/officerTransferRoutes');
const stationRoutes = require('./routes/stationRoutes');
const custodyRoutes = require('./routes/custodyRoutes');
const obEntryRoutes = require('./routes/obEntryRoutes');
const administrationStructureRoutes = require('./routes/administrationStructureRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const searchRoutes = require('./routes/searchRoutes');
const courtRoutes = require('./routes/courtRoutes');
const cidRoutes = require('./routes/cidRoutes');
const districtOperationsRoutes = require('./routes/districtOperationsRoutes');
const legalPersonnelRoutes = require('./routes/legalPersonnelRoutes');
const warrantRoutes = require('./routes/warrantRoutes');
const permissionRoutes = require('./routes/permissionRoutes');
const operationsDashboardRoutes = require('./routes/operationsDashboardRoutes');

const app = express();

// Middleware
const allowedOrigins = getAllowedOrigins();
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
const resolvedUploadDir = path.resolve(__dirname, '..', uploadDir);
fs.mkdirSync(resolvedUploadDir, { recursive: true });
app.use('/uploads', express.static(resolvedUploadDir));

// Health route
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'police-management-backend',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'police-management-backend',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/state-administrations', stateAdministrationRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/districts', districtRoutes);
app.use('/api/ranks', rankRoutes);
app.use('/api/police-officers', policeOfficerRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/criminals', suspectRoutes);
app.use('/api/suspects', suspectRoutes);
app.use('/api/victims', victimRoutes);
app.use('/api/witnesses', witnessRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/arrests', arrestRoutes);
app.use('/api/confirmations', confirmationRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/officer-transfers', officerTransferRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/custody', custodyRoutes);
app.use('/api/ob-entries', obEntryRoutes);
app.use('/api/administration-structure', administrationStructureRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/court', courtRoutes);
app.use('/api/cid', cidRoutes);
app.use('/api/district-operations', districtOperationsRoutes);
app.use('/api/legal-personnel', legalPersonnelRoutes);
app.use('/api/warrants', warrantRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/operations-dashboard', operationsDashboardRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Police Case Management System API - Running' });
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = port;

const autoInitializeDb = require('../database/autoInitDb');

const start = async () => {
  try {
    await testConnection();
    await autoInitializeDb();
    const db = require('./config/database');
    await runOneTimeArrestStatusRepair(db);
    await runOneTimeOfficerAssignmentRepair(db);
    await connectMongoDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Application startup failed:', err);
    process.exit(1);
  }
};

start();
