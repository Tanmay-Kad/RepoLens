import express from 'express';
import { getAiSummary, searchFiles } from '../controllers/aiController.js';

const router = express.Router();

router.post('/summary', getAiSummary);
router.post('/search', searchFiles);

export default router;
