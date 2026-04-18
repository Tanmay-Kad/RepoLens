import { performAnalysis } from '../services/analyzeService.js';
import Repository from '../models/Repository.js';
import { simpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';
import madge from 'madge';

export const analyzeRepository = async (req, res) => {
  console.log('Incoming Payload:', req.body);
  const url = req.body.url || req.body.repoUrl || req.body.githubUrl;

  if (!url || !url.includes('github.com')) {
    return res.status(400).json({ error: 'Valid GitHub URL is required.' });
  }

  try {
    console.log(`[Analyze] Starting analysis for URL: ${url}`);
    const git = simpleGit();
    
    // Validate repository
    console.log(`[Analyze] Validating remote repository...`);
    try {
      const remoteInfo = await git.listRemote([url]);
      if (!remoteInfo || remoteInfo.trim() === '') {
        return res.status(400).json({ error: 'Repository is empty or invalid.' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Repository is private or invalid.' });
    }

    // Check if we already analyzed and cloned this repo — return cached result instantly
    let repo = await Repository.findOne({ url });
    if (repo && repo.cloneStatus === 'completed' && repo.localPath && fs.existsSync(repo.localPath)) {
      return res.status(200).json({
        message: 'Analysis complete (cached)',
        data: repo,
        success: true,
        repoId: repo._id,
        localPath: repo.localPath
      });
    }

    if (!repo) {
      repo = new Repository({ url, status: 'pending', cloneStatus: 'pending' });
      await repo.save();
    }

    repo.status = 'analyzing';
    await repo.save();
    console.log(`[Analyze] Database record created/updated. Status: analyzing`);

    const analysisResult = await performAnalysis(url);
    console.log(`[Analyze] Static analysis (mock) complete.`);
    
    repo.status = 'completed';
    repo.metrics = analysisResult;
    await repo.save();
    console.log(`[Analyze] Metrics saved to database.`);

    // Clone Repository
    console.log(`[Analyze] Preparing to clone repository...`);
    repo.cloneStatus = 'cloning';
    await repo.save();

    // Ensure the parent directory exists
    const projectRoot = path.join(process.cwd(), '..');
    const parentDir = path.join(projectRoot, 'cloned-repos');
    if (!fs.existsSync(parentDir)) {
      console.log(`[Analyze] Creating parent directory: ${parentDir}`);
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const cloneDir = path.join(parentDir, `${repo.id}-${repoName}`);
    console.log(`[Analyze] Target clone directory: ${cloneDir}`);

    // If the directory already exists (e.g. from a previous cancelled run), remove it
    if (fs.existsSync(cloneDir)) {
      console.log(`[Analyze] Cleaning up existing directory...`);
      fs.rmSync(cloneDir, { recursive: true, force: true });
    }

    try {
      console.log(`[Analyze] Starting git clone (shallow)...`);
      // Use shallow clone to make copying large repositories much faster
      await git.clone(url, cloneDir, ['--depth', '1', '--single-branch']);
      console.log(`[Analyze] Clone successful.`);
      repo.localPath = cloneDir;
      repo.cloneStatus = 'completed';
      await repo.save();
    } catch (cloneErr) {
      console.error('Clone error detailed:', cloneErr);
      repo.cloneStatus = 'failed';
      await repo.save();
      return res.status(500).json({ 
        error: 'Failed to clone repository', 
        details: cloneErr.message,
        command: cloneErr.command
      });
    }

    res.status(200).json({ 
      message: 'Analysis complete',
      data: repo,
      success: true, 
      repoId: repo._id, 
      localPath: repo.localPath
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to process repository' });
  }
};

import mongoose from 'mongoose';

export const getGraphData = async (req, res) => {
  const { repoId } = req.params;

  try {
    // Prevent Mongoose CastError crashing the scope by validating ObjectId
    if (!mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ error: 'Invalid repository ID format.' });
    }

    const repo = await Repository.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    if (!repo.localPath || !fs.existsSync(repo.localPath)) {
      return res.status(400).json({ error: 'Repository clone not available for analysis.' });
    }

    // Check if graph data already generated
    if (repo.graphData && repo.graphData.nodes && repo.graphData.nodes.length > 0) {
      return res.status(200).json({ 
        nodes: repo.graphData.nodes, 
        edges: repo.graphData.edges,
        circular: repo.graphData.circular
      });
    }

    // Fix path resolution specifically for Windows environments
    const absoluteLocalPath = path.resolve(repo.localPath);
    console.log(`[Graph] Starting Madge analysis on resolved path: ${absoluteLocalPath}`);

    // Generate graph using Madge
    let resMadge;
    try {
      console.log(`[Graph] Invoking Madge...`);
      resMadge = await madge(absoluteLocalPath, {
        includeNpm: false,
        fileExtensions: ['js', 'jsx', 'ts', 'tsx']
      });
      console.log(`[Graph] Madge analysis complete.`);
    } catch (madgeErr) {
      console.error('Madge initialization specifically failed:', madgeErr);
      return res.status(500).json({ error: 'Madge analysis failed', details: madgeErr.message });
    }

    const obj = resMadge.obj();
    const circular = resMadge.circular();

    const nodes = [];
    const edges = [];

    const fileKeys = Object.keys(obj);
    for (const file of fileKeys) {
      nodes.push({ id: file }); 
      const deps = obj[file];
      for (const target of deps) {
        edges.push({ source: file, target });
      }
    }

    repo.graphData = {
      nodes,
      edges,
      circular
    };
    
    await repo.save();

    res.status(200).json({
      nodes: repo.graphData.nodes,
      edges: repo.graphData.edges,
      circular: repo.graphData.circular
    });

  } catch (error) {
    console.error('Graph extraction error:', error);
    res.status(500).json({ error: 'Failed to extract dependency graph' });
  }
};
