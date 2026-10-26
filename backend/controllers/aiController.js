import Repository from '../models/Repository.js';
import { generateFileSummary, searchFilesWithAI } from '../services/geminiService.js';
import config from '../utils/config.js';
import mongoose from 'mongoose';

export const getAiSummary = async (req, res) => {
  if (!config.hasGeminiKey) {
    return res.status(503).json({ error: 'AI features unavailable. GEMINI_API_KEY is not configured on the server.' });
  }

  const { repoId, fileName, dependencies, dependents } = req.body;

  if (!repoId || !fileName) {
    return res.status(400).json({ error: 'repoId and fileName are required.' });
  }

  if (!mongoose.Types.ObjectId.isValid(repoId)) {
    return res.status(400).json({ error: 'Invalid repository ID.' });
  }

  try {
    const repo = await Repository.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    // Sanitize fileName because Mongoose Map keys cannot contain '.'
    const safeFileNameKey = fileName.replace(/\./g, '_dot_');

    // Return cached summary if available
    if (repo.aiSummaries && repo.aiSummaries.get(safeFileNameKey)) {
      const cached = JSON.parse(repo.aiSummaries.get(safeFileNameKey));
      return res.status(200).json({ summary: cached, cached: true });
    }

    // Generate using Gemini
    const summary = await generateFileSummary({
      fileName,
      dependencies,
      dependents,
      repoUrl: repo.url,
    });

    // Cache result in MongoDB
    repo.aiSummaries.set(safeFileNameKey, JSON.stringify(summary));
    await repo.save();

    res.status(200).json({ summary, cached: false });

  } catch (error) {
    console.error('Gemini AI summary error:', error?.message || 'Unknown error');
    res.status(500).json({ error: 'AI summary unavailable.' });
  }
};

export const searchFiles = async (req, res) => {
  if (!config.hasGeminiKey) {
    return res.status(503).json({ error: 'AI features unavailable. GEMINI_API_KEY is not configured on the server.' });
  }

  const { query, nodes } = req.body;

  if (typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Search query is required.' });
  }

  if (query.trim().length > 300) {
    return res.status(400).json({ error: 'Search query exceeds maximum length of 300 characters.' });
  }

  if (!Array.isArray(nodes) || nodes.length === 0) {
    return res.status(400).json({ error: 'Nodes array is required.' });
  }

  if (nodes.length > 500) {
    return res.status(400).json({ error: 'Nodes array exceeds maximum limit of 500 files.' });
  }

  try {
    const results = await searchFilesWithAI({ query: query.trim(), nodes });
    res.status(200).json({ results });
  } catch (error) {
    console.error('Gemini AI search error:', error?.message || 'Unknown error');
    res.status(500).json({ error: 'AI search unavailable.' });
  }
};
