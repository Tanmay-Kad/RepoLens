import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import connectDB from './utils/db.js';
import analyzeRoutes from './routes/analyzeRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', analyzeRoutes);
app.use('/api/ai', aiRoutes);

// Database Connection and Server Startup
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to connect to database', err);
});
