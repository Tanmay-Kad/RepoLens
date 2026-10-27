import path from 'path';
import fsPromises from 'fs/promises';
import mongoose from 'mongoose';
import Repository from '../models/Repository.js';
import config from '../utils/config.js';
import { parseGitHubUrl } from '../utils/githubUrl.js';
import { assertSafePath } from '../utils/pathSafety.js';
import {
  preCheckGitHubRepoSize,
  validateRemote,
  cloneRepositorySafely,
} from '../services/cloneService.js';
import { Semaphore } from '../utils/semaphore.js';
import { analyzeRepositoryGraph } from '../services/graphAnalyzer.js';
import { METRIC_DEFINITIONS } from '../services/metricsService.js';

// In-process deduplication maps
export const inFlightAnalyses = new Map();
export const inFlightGraphs = new Map();

// Concurrency limiter for clone and analysis operations
export const analysisSemaphore = new Semaphore(config.maxConcurrentAnalyses);



export const analyzeRepository = async (req, res) => {
  const rawUrl = req.body?.url || req.body?.repoUrl || req.body?.githubUrl;

  const validation = parseGitHubUrl(rawUrl);
  if (!validation.isValid) {
    return res.status(400).json({ error: validation.error });
  }

  const normalizedUrl = validation.normalizedUrl;

  // 1. In-flight deduplication: if an analysis for this exact repo is currently running, share it
  if (inFlightAnalyses.has(normalizedUrl)) {
    try {
      const sharedResult = await inFlightAnalyses.get(normalizedUrl);
      return res.status(200).json(sharedResult);
    } catch (inFlightErr) {
      if (inFlightErr.retryAfter) {
        res.set('Retry-After', inFlightErr.retryAfter);
      }
      const status = inFlightErr.statusCode || inFlightErr.code || 500;
      const safeStatus = (typeof status === 'number' && status >= 400 && status < 600) ? status : 500;
      return res.status(safeStatus).json({ error: inFlightErr.message || 'Repository analysis failed.' });
    }
  }

  // 2. Create in-flight analysis task and register in map SYNCHRONOUSLY before any await
  const taskPromise = (async () => {
    let semaphoreAcquired = false;
    try {
      // Check database cache first: if already analyzed and completed, return immediately
      try {
        const existingRepo = await Repository.findOne({ url: normalizedUrl });
        if (existingRepo && existingRepo.status === 'completed' && existingRepo.graphData?.nodes?.length > 0) {
          return {
            success: true,
            message: 'Analysis complete (cached)',
            repoId: existingRepo._id.toString(),
            data: {
              id: existingRepo._id.toString(),
              url: existingRepo.url,
              status: existingRepo.status,
              createdAt: existingRepo.createdAt,
            },
          };
        }
      } catch (_dbErr) {
        // Continue if DB check fails
      }

      // Acquire concurrency semaphore slot
      if (!analysisSemaphore.tryAcquire()) {
        const capErr = new Error('Analysis server is at capacity. Please try again in a few moments.');
        capErr.statusCode = 503;
        capErr.retryAfter = '60';
        throw capErr;
      }
      semaphoreAcquired = true;

      // Pre-check repository size via public GitHub API
      const sizeCheck = await preCheckGitHubRepoSize(validation.owner, validation.repo, config.maxRepoSizeMb);
      if (!sizeCheck.allowed) {
        const sizeErr = new Error(sizeCheck.reason);
        sizeErr.statusCode = 413;
        throw sizeErr;
      }

      // Check remote accessibility
      const isAccessible = await validateRemote(normalizedUrl);
      if (!isAccessible) {
        const accessErr = new Error('Repository is private, empty, or inaccessible.');
        accessErr.statusCode = 400;
        throw accessErr;
      }

      // Atomic upsert to avoid duplicate records
      const repo = await Repository.findOneAndUpdate(
        { url: normalizedUrl },
        {
          $setOnInsert: {
            url: normalizedUrl,
            status: 'pending',
            cloneStatus: 'pending',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      repo.status = 'analyzing';
      repo.cloneStatus = 'cloning';
      await repo.save();

      // Resolve safe clone directory
      const safeId = String(repo._id).replace(/[^a-fA-F0-9]/g, '');
      const safeRepoName = validation.repo.replace(/[^a-zA-Z0-9_.-]/g, '');
      const cloneDir = path.resolve(config.cloneRoot, `${safeId}-${safeRepoName}`);

      try {
        await cloneRepositorySafely({
          url: normalizedUrl,
          targetDir: cloneDir,
          cloneRoot: config.cloneRoot,
          timeoutMs: config.cloneTimeoutMs,
          maxFiles: config.maxRepoFiles,
          maxSizeMb: config.maxRepoSizeMb,
        });

        repo.localPath = cloneDir;
        repo.cloneStatus = 'completed';
        repo.status = 'completed';
        await repo.save();
      } catch (cloneErr) {
        repo.status = 'failed';
        repo.cloneStatus = 'failed';
        await repo.save().catch(() => {});
        throw cloneErr;
      }

      return {
        success: true,
        message: 'Analysis complete',
        repoId: repo._id.toString(),
        data: {
          id: repo._id.toString(),
          url: repo.url,
          status: repo.status,
          createdAt: repo.createdAt,
        },
      };

    } finally {
      if (semaphoreAcquired) {
        analysisSemaphore.release();
      }
      inFlightAnalyses.delete(normalizedUrl);
    }
  })();

  inFlightAnalyses.set(normalizedUrl, taskPromise);

  try {
    const result = await taskPromise;
    return res.status(200).json(result);
  } catch (err) {
    if (err.retryAfter) {
      res.set('Retry-After', err.retryAfter);
    }
    const statusCode = err.statusCode || err.code || 500;
    const safeStatus = (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) ? statusCode : 500;
    return res.status(safeStatus).json({
      error: err.message || 'Failed to process repository.',
    });
  }
};

export const isAnalyzerVersionCurrent = (version, currentVersion = config.analyzerVersion) =>
  typeof version === 'number' && Number.isInteger(version) && version >= currentVersion;

export const getGraphData = async (req, res) => {
  const { repoId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ error: 'Invalid repository ID format.' });
    }

    const repo = await Repository.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    // Derive repo info from stored URL
    let repoMeta = undefined;
    if (repo && repo.url) {
      const parsed = parseGitHubUrl(repo.url);
      if (parsed.isValid) {
        repoMeta = {
          url: parsed.normalizedUrl,
          owner: parsed.owner,
          name: parsed.repo,
        };
      }
    }

    const buildResponsePayload = (basePayload) => {
      const payload = {
        nodes: basePayload.nodes,
        edges: basePayload.edges,
        circular: basePayload.circular,
        metrics: basePayload.metrics,
        analysis: basePayload.analysis || {},
        metricDefinitions: METRIC_DEFINITIONS,
      };
      if (repoMeta) {
        payload.repo = repoMeta;
      }
      return payload;
    };

    // 1. Check if graph data already exists AND has current analyzerVersion
    const isCurrent = isAnalyzerVersionCurrent(repo.analyzerVersion);
    const hasData = repo.graphData && Array.isArray(repo.graphData.nodes) && repo.metrics && Object.keys(repo.metrics).length > 0;

    if (isCurrent && hasData) {
      return res.status(200).json(buildResponsePayload({
        nodes: repo.graphData.nodes, 
        edges: repo.graphData.edges,
        circular: repo.graphData.circular,
        metrics: repo.metrics,
        analysis: repo.analysis || {},
      }));
    }

    // 2. Otherwise (missing or stale version): run analysis through in-flight dedupe and semaphore
    if (inFlightGraphs.has(repoId)) {
      console.log(`[Dedupe] Concurrent GET /graph attached to in-flight analysis for repoId: ${repoId}`);
      try {
        const sharedResult = await inFlightGraphs.get(repoId);
        return res.status(200).json(sharedResult);
      } catch (inFlightErr) {
        if (inFlightErr.retryAfter) {
          res.set('Retry-After', inFlightErr.retryAfter);
        }
        const status = inFlightErr.statusCode || inFlightErr.code || 500;
        const safeStatus = (typeof status === 'number' && status >= 400 && status < 600) ? status : 500;
        return res.status(safeStatus).json({ error: inFlightErr.message || 'Graph analysis failed.' });
      }
    }

    const taskPromise = (async () => {
      let semaphoreAcquired = false;
      try {
        console.log(`[Analysis] Executing graph analysis for repoId: ${repoId}`);
        if (!analysisSemaphore.tryAcquire()) {
          const capErr = new Error('Analysis server is at capacity. Please try again in a few moments.');
          capErr.statusCode = 503;
          capErr.retryAfter = '60';
          throw capErr;
        }
        semaphoreAcquired = true;

        // Clone-as-cache check: verify clone exists on disk, else re-clone
        let localPath = repo.localPath;
        const pathCheck = localPath ? assertSafePath(localPath, config.cloneRoot) : { isSafe: false };

        let cloneOnDisk = false;
        if (pathCheck.isSafe) {
          try {
            const stat = await fsPromises.stat(pathCheck.resolvedPath);
            cloneOnDisk = stat.isDirectory();
          } catch (_) {
            cloneOnDisk = false;
          }
        }

        if (!cloneOnDisk) {
          const parsed = parseGitHubUrl(repo.url);
          if (!parsed.isValid) {
            const urlErr = new Error('Invalid repository URL stored for analysis.');
            urlErr.statusCode = 400;
            throw urlErr;
          }

          const safeId = String(repo._id).replace(/[^a-fA-F0-9]/g, '');
          const safeRepoName = parsed.repo.replace(/[^a-zA-Z0-9_.-]/g, '');
          const cloneDir = path.resolve(config.cloneRoot, `${safeId}-${safeRepoName}`);

          try {
            await cloneRepositorySafely({
              url: repo.url,
              targetDir: cloneDir,
              cloneRoot: config.cloneRoot,
              timeoutMs: config.cloneTimeoutMs,
              maxFiles: config.maxRepoFiles,
              maxSizeMb: config.maxRepoSizeMb,
            });
            repo.localPath = cloneDir;
            repo.cloneStatus = 'completed';
            await repo.save();
            localPath = cloneDir;
          } catch (recloneErr) {
            const reclErr = new Error('Repository clone unavailable for analysis.');
            reclErr.statusCode = 500;
            throw reclErr;
          }
        }

        const absoluteLocalPath = path.resolve(localPath);

        // Run isolated graph analysis with worker thread and compute metrics
        const analysisResult = await analyzeRepositoryGraph({
          targetDir: absoluteLocalPath,
          maxMemoryMb: config.analysisMaxMemoryMb,
          timeoutMs: config.analysisTimeoutMs,
        });

        const graphPayload = {
          nodes: analysisResult.graphData.nodes,
          edges: analysisResult.graphData.edges,
          circular: analysisResult.graphData.circular,
          metrics: analysisResult.metrics,
          analysis: analysisResult.analysis,
        };

        // Guard Mongo document size limit: ensure graphData does not exceed 12MB limit
        const estimatedBytes = Buffer.byteLength(JSON.stringify(graphPayload));
        if (estimatedBytes > 12 * 1024 * 1024) {
          const sizeErr = new Error('Graph data exceeds maximum database document size limit (12MB).');
          sizeErr.statusCode = 413;
          throw sizeErr;
        }

        repo.graphData = analysisResult.graphData;
        repo.metrics = analysisResult.metrics;
        repo.analysis = analysisResult.analysis;
        repo.analyzerVersion = config.analyzerVersion;
        await repo.save();

        return buildResponsePayload(graphPayload);
      } finally {
        if (semaphoreAcquired) {
          analysisSemaphore.release();
        }
        inFlightGraphs.delete(repoId);
      }
    })();

    inFlightGraphs.set(repoId, taskPromise);

    try {
      const result = await taskPromise;
      return res.status(200).json(result);
    } catch (err) {
      if (err.retryAfter) {
        res.set('Retry-After', err.retryAfter);
      }
      const statusCode = err.statusCode || err.code || 500;
      const safeStatus = (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) ? statusCode : 500;
      return res.status(safeStatus).json({
        error: err.message || 'Failed to extract dependency graph.',
      });
    }

  } catch (error) {
    console.error('Graph extraction error:', error?.message || 'Unknown error');
    res.status(500).json({ error: 'Failed to extract dependency graph.' });
  }
};

export const runSecurityAudit = async (req, res) => {
  const { repoId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ error: 'Invalid repository ID format.' });
    }

    const repo = await Repository.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    return res.status(200).json({
      auditFound: false,
      available: false,
      message: 'Security audit is temporarily unavailable while it is rebuilt.',
    });
  } catch (error) {
    console.error('Security audit error:', error?.message || 'Audit error');
    res.status(500).json({ error: 'Security audit failed.' });
  }
};
