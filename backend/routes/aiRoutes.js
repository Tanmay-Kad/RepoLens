import express from 'express';
import { getAiSummary } from '../controllers/aiController.js';

const router = express.Router();

router.post('/summary', getAiSummary);

export default router;
