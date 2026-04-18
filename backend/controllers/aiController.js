import Repository from '../models/Repository.js';
import { generateFileSummary } from '../services/geminiService.js';
import mongoose from 'mongoose';

export const getAiSummary = async (req, res) => {
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

    // Return cached summary if available
    if (repo.aiSummaries && repo.aiSummaries.get(fileName)) {
      const cached = JSON.parse(repo.aiSummaries.get(fileName));
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
    repo.aiSummaries.set(fileName, JSON.stringify(summary));
    await repo.save();

    res.status(200).json({ summary, cached: false });

  } catch (error) {
    console.error('Gemini AI summary error:', error);
    res.status(500).json({ error: 'AI summary unavailable.', details: error.message });
  }
};
