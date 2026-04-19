import express from 'express';
import { getAiSummary, semanticSearch, chatCodebase, getOnboardingPath } from '../controllers/aiController.js';

const router = express.Router();

router.post('/summary', getAiSummary);
router.get('/semantic-search/:repoId', semanticSearch);
router.post('/chat/:repoId', chatCodebase);
router.get('/onboarding/:repoId', getOnboardingPath);

export default router;
