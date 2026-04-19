import mongoose from 'mongoose';
import Repository from '../models/Repository.js';
import { generateFileSummary, queryCodebaseAI, chatWithCodebaseAI, generateOnboardingReasons } from '../services/groqService.js';
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

    const mapKey = fileName.replace(/\./g, '__').replace(/\//g, '___');

    if (repo.aiSummaries && repo.aiSummaries.get(mapKey)) {
      const cached = JSON.parse(repo.aiSummaries.get(mapKey));
      return res.status(200).json({ summary: cached, cached: true });
    }

    let codeContent = '(No content available)';
    try {
      const targetFilePath = path.join(repo.localPath, fileName);
      if (fs.existsSync(targetFilePath)) {
        const stats = fs.statSync(targetFilePath);
        if (stats.size < 1000000) {
           codeContent = fs.readFileSync(targetFilePath, 'utf-8').slice(0, 30000);
        } else {
           codeContent = '// File too large to process for summary.';
        }
      }
    } catch (readErr) {
      console.error(`Failed to read file ${fileName}:`, readErr.message);
    }

    const summary = await generateFileSummary({
      fileName,
      dependencies,
      dependents,
      repoUrl: repo.url,
      codeContent,
    });

    repo.aiSummaries.set(mapKey, JSON.stringify(summary));
    await repo.save();

    res.status(200).json({ summary, cached: false });

  } catch (error) {
    console.error('Gemini AI summary error:', error);
    const status = error.status || 500;
    let message = 'AI summary unavailable.';
    
    if (status === 429) {
      message = 'AI rate limit reached. Please try again in a few minutes.';
    } else if (status === 503) {
      message = 'Gemini AI is temporarily unavailable. Please try again later.';
    }
    
    res.status(status).json({ error: message, details: error.message });
  }
};

export const semanticSearch = async (req, res) => {
  const { repoId } = req.params;
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ error: 'Query is strictly required for AI search.' });
  }

  try {
    const repo = await Repository.findById(repoId);
    if (!repo || !repo.graphData || !repo.graphData.nodes) {
      return res.status(404).json({ error: 'Repository or map not found.' });
    }

    const fileManifest = repo.graphData.nodes.map(n => n.id);
    
    const searchResult = await queryCodebaseAI({
      query: q,
      fileManifest
    });

    const results = (searchResult.matches || []).map(match => ({
      file: match.file,
      aiMatch: true,
      reason: match.reason
    }));

    res.status(200).json({ results, totalCount: results.length });
  } catch (error) {
    console.error('Semantic search error:', error);
    res.status(500).json({ error: 'Failed to execute structural AI search.' });
  }
};

export const chatCodebase = async (req, res) => {
  const { repoId } = req.params;
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid conversational schema.' });
  }

  try {
    const repo = await Repository.findById(repoId);
    if (!repo || !repo.graphData || !repo.graphData.nodes) {
      return res.status(404).json({ error: 'Repository or architecture map not found.' });
    }

    const fileManifest = repo.graphData.nodes.map(n => n.id);
    
    const reply = await chatWithCodebaseAI({
      messages,
      fileManifest
    });

    res.status(200).json({ reply });
  } catch (error) {
    console.error('Codebase chat error:', error);
    res.status(500).json({ error: 'Failed to run AI chat generation.' });
  }
};

export const getOnboardingPath = async (req, res) => {
  const { repoId } = req.params;
  const { mode = 'Quick Start' } = req.query;

  try {
    const repo = await Repository.findById(repoId);
    if (!repo || !repo.graphData || !repo.graphData.nodes) {
      return res.status(404).json({ error: 'Repository or architecture map not found.' });
    }

    const nodes = repo.graphData.nodes;
    const edges = repo.graphData.edges;

    // Topological calculations
    const stats = {};
    nodes.forEach(n => stats[n.id] = { in: 0, out: 0 });
    edges.forEach(e => {
       if (stats[e.source]) stats[e.source].out++;
       if (stats[e.target]) stats[e.target].in++;
    });

    const entry = nodes.filter(n => stats[n.id].in === 0 && stats[n.id].out > 0).sort((a,b) => stats[b.id].out - stats[a.id].out);
    const utils = nodes.filter(n => stats[n.id].out === 0 && stats[n.id].in > 0).sort((a,b) => stats[b.id].in - stats[a.id].in);
    const hubs = nodes.map(n => ({ id: n.id, total: stats[n.id].in + stats[n.id].out })).sort((a,b) => b.total - a.total);

    const limit = mode === 'Quick Start' ? { entry: 1, hubs: 3, utils: 1 } : { entry: 2, hubs: 5, utils: 3 };
    
    const orderedSet = new Set();
    const orderedFiles = [];
    const pushNode = (id, cat) => {
      if (!orderedSet.has(id)) {
        orderedSet.add(id);
        orderedFiles.push({ file: id, category: cat });
      }
    };

    // Build the ordered array logically
    entry.slice(0, limit.entry).forEach(n => pushNode(n.id, 'Entry Point'));
    hubs.forEach(h => {
      if (orderedFiles.length >= (limit.entry + limit.hubs)) return;
      pushNode(h.id, 'Core Business Logic / Hub');
    });
    utils.slice(0, limit.utils).forEach(n => pushNode(n.id, 'Utility Module'));

    // Inject fallback if array failed bounds
    if (orderedFiles.length === 0 && nodes.length > 0) {
      pushNode(nodes[0].id, 'Primary Component');
    }

    const analysis = await generateOnboardingReasons(orderedFiles);
    res.status(200).json({ steps: analysis.steps || [] });

  } catch (error) {
    console.error('Onboarding path generation error:', error);
    res.status(500).json({ error: 'Failed to evaluate topological reading sequence.' });
  }
};
