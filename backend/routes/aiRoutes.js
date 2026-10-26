import express from 'express';
import rateLimit from 'express-rate-limit';
import { getAiSummary, searchFiles } from '../controllers/aiController.js';
import config from '../utils/config.js';

const router = express.Router();

export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.rateLimitAiPerHour,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many AI requests from this IP. Please try again later.' },
});

router.use(aiRateLimiter);

router.post('/summary', getAiSummary);
router.post('/search', searchFiles);

export default router;
