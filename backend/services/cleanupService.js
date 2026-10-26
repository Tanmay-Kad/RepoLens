import fs from 'fs/promises';
import path from 'path';
import config from '../utils/config.js';
import { assertSafePath, safeRemoveDir } from '../utils/pathSafety.js';
import Repository from '../models/Repository.js';

let intervalHandle = null;

/**
 * Runs a single cleanup sweep over cloneRoot.
 *
 * @param {object} [options]
 * @param {string} [options.cloneRoot] - Root directory containing clones
 * @param {number} [options.ttlHours] - TTL in hours
 * @param {Function} [options.clock] - Injectable timestamp generator () => number
 * @param {Function} [options.dbLookup] - Optional custom DB lookup function (dirName) => Promise<boolean>
 * @returns {Promise<{ scanned: number, deletedExpired: number, deletedOrphaned: number, errors: number }>}
 */
export const runCleanupSweep = async ({
  cloneRoot = config.cloneRoot,
  ttlHours = config.cloneTtlHours,
  clock = () => Date.now(),
  dbLookup = null,
} = {}) => {
  let scanned = 0;
  let deletedExpired = 0;
  let deletedOrphaned = 0;
  let errors = 0;

  try {
    const entries = await fs.readdir(cloneRoot, { withFileTypes: true });
    const now = clock();
    const ttlMs = ttlHours * 60 * 60 * 1000;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      scanned++;

      const fullPath = path.join(cloneRoot, entry.name);
      const safeCheck = assertSafePath(fullPath, cloneRoot);
      if (!safeCheck.isSafe) continue;

      try {
        const stats = await fs.stat(fullPath);
        const ageMs = now - stats.mtimeMs;

        // Check 1: Is it older than TTL?
        if (ageMs > ttlMs) {
          await safeRemoveDir(fullPath, cloneRoot);
          deletedExpired++;
          continue;
        }

        // Check 2: Does it match an active repository in the database?
        let hasDbRecord = true;
        if (typeof dbLookup === 'function') {
          hasDbRecord = await dbLookup(entry.name);
        } else {
          const repo = await Repository.findOne({ localPath: fullPath }).select('_id');
          if (!repo) {
            const idPart = entry.name.split('-')[0];
            const repoById = idPart && idPart.length === 24 ? await Repository.findById(idPart).select('_id') : null;
            hasDbRecord = Boolean(repoById);
          }
        }

        if (!hasDbRecord) {
          await safeRemoveDir(fullPath, cloneRoot);
          deletedOrphaned++;
        }
      } catch (_err) {
        errors++;
      }
    }

    if (deletedExpired > 0 || deletedOrphaned > 0) {
      console.log(`[Cleanup] Sweep completed: scanned ${scanned}, pruned ${deletedExpired} expired and ${deletedOrphaned} orphaned directories.`);
    }

    return { scanned, deletedExpired, deletedOrphaned, errors };
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[Cleanup] Failed to read clone directory during sweep:', err?.message || 'Error');
    }
    return { scanned, deletedExpired, deletedOrphaned, errors };
  }
};

/**
 * Starts periodic cleanup timer using unref() so process shutdown and unit tests are never blocked.
 *
 * @param {number} [intervalMinutes]
 * @returns {NodeJS.Timeout}
 */
export const startPeriodicCleanup = (intervalMinutes = config.cleanupIntervalMinutes) => {
  stopPeriodicCleanup();

  // Run initial sweep asynchronously at startup
  runCleanupSweep().catch(err => console.error('[Cleanup] Startup sweep error:', err?.message));

  const intervalMs = intervalMinutes * 60 * 1000;
  intervalHandle = setInterval(() => {
    runCleanupSweep().catch(err => console.error('[Cleanup] Scheduled sweep error:', err?.message));
  }, intervalMs);

  if (intervalHandle.unref) {
    intervalHandle.unref();
  }

  return intervalHandle;
};

export const stopPeriodicCleanup = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};

export default {
  runCleanupSweep,
  startPeriodicCleanup,
  stopPeriodicCleanup,
};
