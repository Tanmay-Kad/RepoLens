import { Worker } from 'node:worker_threads';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import config from '../utils/config.js';
import {
  walkRepoFiles,
  computeRepoMetrics,
} from './metricsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_WORKER_PATH = path.resolve(__dirname, 'graphWorker.js');

/**
 * Executes graph extraction inside an isolated worker_threads Worker with memory limits and wall-clock timeout.
 *
 * @param {object} params
 * @param {string} params.targetDir - Root directory of the cloned repository
 * @param {string} [params.tsConfigPath] - Optional tsconfig.json path
 * @param {number} [params.maxMemoryMb] - Worker maxOldGenerationSizeMb
 * @param {number} [params.timeoutMs] - Hard wall-clock timeout in ms
 * @param {string} [params.workerScriptPath] - Injectable worker script for tests
 * @returns {Promise<{ rawTree: object, circular: Array<string[]>, warnings: string[] }>}
 */
export const runWorkerGraphExtraction = ({
  targetDir,
  tsConfigPath = null,
  maxMemoryMb = config.analysisMaxMemoryMb,
  timeoutMs = config.analysisTimeoutMs,
  workerScriptPath = DEFAULT_WORKER_PATH,
}) => {
  return new Promise((resolve, reject) => {
    let timer = null;
    let isSettled = false;

    const worker = new Worker(workerScriptPath, {
      workerData: { targetDir, tsConfigPath },
      resourceLimits: {
        maxOldGenerationSizeMb: maxMemoryMb,
      },
    });

    const cleanup = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    timer = setTimeout(async () => {
      if (isSettled) return;
      isSettled = true;
      try {
        await worker.terminate();
      } catch (_) {}
      const timeoutErr = new Error(`Graph analysis timed out after ${timeoutMs}ms.`);
      timeoutErr.code = 'ANALYSIS_TIMEOUT';
      timeoutErr.statusCode = 504;
      reject(timeoutErr);
    }, timeoutMs);

    worker.on('message', (message) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();

      if (message.success) {
        resolve(message.result);
      } else {
        const err = new Error(message.error || 'Graph analysis failed.');
        err.code = 'ANALYSIS_ERROR';
        reject(err);
      }
    });

    worker.on('error', (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      const workerErr = new Error('Graph analysis worker crashed or threw an unhandled error.');
      workerErr.code = 'WORKER_ERROR';
      workerErr.original = err?.message;
      reject(workerErr);
    });

    worker.on('exit', (exitCode) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      if (exitCode !== 0) {
        const crashErr = new Error(`Graph analysis worker terminated unexpectedly with exit code ${exitCode}.`);
        crashErr.code = 'WORKER_CRASHED';
        reject(crashErr);
      }
    });
  });
};

/**
 * High-level analysis pipeline: verifies tsconfig, runs isolated worker, computes metrics, and enriches nodes.
 *
 * @param {object} params
 * @param {string} params.targetDir
 * @param {number} [params.maxMemoryMb]
 * @param {number} [params.timeoutMs]
 * @param {string} [params.workerScriptPath]
 * @returns {Promise<{
 *   graphData: { nodes: any[], edges: any[], circular: any[] },
 *   metrics: object,
 *   analysis: object
 * }>}
 */
export const analyzeRepositoryGraph = async ({
  targetDir,
  maxMemoryMb = config.analysisMaxMemoryMb,
  timeoutMs = config.analysisTimeoutMs,
  workerScriptPath = DEFAULT_WORKER_PATH,
}) => {
  const warnings = [];

  // 1. Check for tsconfig.json at repo root
  let validTsConfigPath = null;
  const potentialTsConfig = path.join(targetDir, 'tsconfig.json');
  try {
    const stat = await fs.stat(potentialTsConfig);
    if (stat.isFile()) {
      const rawText = await fs.readFile(potentialTsConfig, 'utf8');
      try {
        JSON.parse(rawText);
        validTsConfigPath = potentialTsConfig;
      } catch (parseErr) {
        warnings.push('tsconfig.json at root could not be parsed; path aliases will not be resolved.');
      }
    }
  } catch (_) {
    // No tsconfig.json present
  }

  // 2. Run isolated worker graph extraction
  const workerResult = await runWorkerGraphExtraction({
    targetDir,
    tsConfigPath: validTsConfigPath,
    maxMemoryMb,
    timeoutMs,
    workerScriptPath,
  });

  // 3. Scan files in repository for metric aggregation
  const { allFiles, manifestFiles, htmlFiles } = await walkRepoFiles(targetDir);

  // 4. Combine warnings
  const combinedWarnings = [
    ...warnings,
    ...(workerResult.warnings || []),
  ];

  // 5. Compute full metrics and enriched graph
  const result = await computeRepoMetrics({
    rootDir: targetDir,
    rawTree: workerResult.rawTree || {},
    circular: workerResult.circular || [],
    allFiles,
    manifestFiles,
    htmlFiles,
    madgeWarnings: combinedWarnings,
  });

  return result;
};

export default {
  runWorkerGraphExtraction,
  analyzeRepositoryGraph,
};
