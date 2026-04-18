import Repository from '../models/Repository.js';
import { generateFileSummary } from '../services/groqService.js';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

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

    // Mongoose Maps don't allow keys containing '.' or other special path characters.
    // We replace dots with double-underscore and slashes with triple-underscore.
    const mapKey = fileName.replace(/\./g, '__').replace(/\//g, '___');

    // Return cached summary if available
    if (repo.aiSummaries && repo.aiSummaries.get(mapKey)) {
      const cached = JSON.parse(repo.aiSummaries.get(mapKey));
      return res.status(200).json({ summary: cached, cached: true });
    }

    // Read file content from disk to provide context to Gemini
    let codeContent = '(No content available)';
    try {
      const targetFilePath = path.join(repo.localPath, fileName);
      if (fs.existsSync(targetFilePath)) {
        // Limit to 30k characters to stay within model limits and avoid processing huge files
        const stats = fs.statSync(targetFilePath);
        if (stats.size < 1000000) { // Only read files smaller than 1MB
           codeContent = fs.readFileSync(targetFilePath, 'utf-8').slice(0, 30000);
        } else {
           codeContent = '// File too large to process for summary.';
        }
      }
    } catch (readErr) {
      console.error(`Failed to read file ${fileName}:`, readErr.message);
    }

    // Generate using Gemini
    const summary = await generateFileSummary({
      fileName,
      dependencies,
      dependents,
      repoUrl: repo.url,
      codeContent,
    });

    // Cache result in MongoDB
    repo.aiSummaries.set(mapKey, JSON.stringify(summary));
    await repo.save();

    res.status(200).json({ summary, cached: false });

  } catch (error) {
    console.error('Gemini AI summary error:', error);
    
    // Check if it's a known API error (status code like 429 or 503)
    const status = error.status || 500;
    let message = 'AI summary unavailable.';
    
    if (status === 429) {
      message = 'AI rate limit reached. Please try again in a few minutes.';
    } else if (status === 503) {
      message = 'Gemini AI is temporarily unavailable. Please try again later.';
    }
    
    res.status(status).json({ 
      error: message, 
      details: error.message 
    });
  }
};
