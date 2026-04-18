import express from 'express';
import { analyzeRepository, getGraphData } from '../controllers/analyzeController.js';

const router = express.Router();

router.post('/analyze', analyzeRepository);
router.get('/graph/:repoId', getGraphData);

export default router;
