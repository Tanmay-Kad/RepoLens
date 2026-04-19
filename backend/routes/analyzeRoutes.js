import express from 'express';
import { analyzeRepository, getGraphData } from '../controllers/analyzeController.js';
import { searchCodebase } from '../controllers/searchController.js';

const router = express.Router();

router.post('/analyze', analyzeRepository);
router.get('/graph/:repoId', getGraphData);
router.get('/search/:repoId', searchCodebase);

export default router;
