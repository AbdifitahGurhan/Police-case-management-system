// src/app.js — Main Express entry point
'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { connectMongoDB } = require('./config/mongodb');
const errorHandler = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const stateAdministrationRoutes = require('./routes/stateAdministrationRoutes');
const regionRoutes = require('./routes/regionRoutes');
const cityRoutes = require('./routes/cityRoutes');
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

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/state-administrations', stateAdministrationRoutes);
app.use('/api/regions', regionRoutes);
app.use('/api/cities', cityRoutes);
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

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Police Case Management System API — Running' });
});

// Error handling
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const start = async () => {
  try {
    await testConnection();
    await connectMongoDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
};

start();
