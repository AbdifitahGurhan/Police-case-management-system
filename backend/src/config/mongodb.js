// src/config/mongodb.js - MongoDB connection using mongoose
'use strict';

const mongoose = require('mongoose');
require('dotenv').config();

async function connectMongoDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('MongoDB connection skipped: MONGODB_URI is not set');
    return null;
  }

  mongoose.connection.on('connected', () => {
    console.log('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected');
  });

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS, 10) || 5000,
  });

  return mongoose.connection;
}

async function disconnectMongoDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectMongoDB, disconnectMongoDB };
