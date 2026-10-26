import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import config, { isOriginAllowed } from './utils/config.js';
import connectDB from './utils/db.js';
import analyzeRoutes from './routes/analyzeRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import { startPeriodicCleanup, stopPeriodicCleanup } from './services/cleanupService.js';

const app = express();
const PORT = config.port;

if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// CORS configuration: dev allows localhost/vite, prod allows only CORS_ORIGINS; no-origin requests always allowed
const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin, config.corsOrigins, config.isDev)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  const mongo = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    mongo,
  });
});

// Routes
app.use('/api', analyzeRoutes);
app.use('/api/ai', aiRoutes);

let server = null;

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
  console.log(`Received ${signal}. Starting graceful shutdown...`);
  stopPeriodicCleanup();

  if (server) {
    server.close(() => {
      console.log('HTTP server closed.');
    });
  }

  try {
    await mongoose.connection.close(false);
    console.log('MongoDB connection closed.');
  } catch (err) {
    console.error('Error closing MongoDB connection:', err?.message || 'Error');
  }

  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Database Connection and Server Startup
connectDB().then(() => {
  startPeriodicCleanup();
  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to database', err?.message || 'Unknown error');
});
