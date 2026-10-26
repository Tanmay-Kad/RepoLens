import express from 'express';
import rateLimit from 'express-rate-limit';
import { analyzeRepository, getGraphData, runSecurityAudit } from '../controllers/analyzeController.js';
import config from '../utils/config.js';

const router = express.Router();

export const analyzeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: config.rateLimitAnalyzePerHour,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many repository analysis requests from this IP. Please try again later.' },
});

router.post('/analyze', analyzeRateLimiter, analyzeRepository);
router.get('/graph/:repoId', getGraphData);
router.get('/audit/:repoId', runSecurityAudit);

export default router;
