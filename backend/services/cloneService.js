import { simpleGit } from 'simple-git';
import fs from 'fs/promises';
import path from 'path';
import config from '../utils/config.js';
import { assertSafePath, safeRemoveDir } from '../utils/pathSafety.js';

/**
 * Pre-checks repository size via GitHub public API if available.
 * Does not require credentials. If rate-limited or unavailable, gracefully skips.
 *
 * @param {string} owner
 * @param {string} repo
 * @param {number} maxSizeMb
 * @returns {Promise<{ allowed: boolean, sizeMb?: number, reason?: string }>}
 */
export const preCheckGitHubRepoSize = async (owner, repo, maxSizeMb = config.maxRepoSizeMb) => {
  try {
    const headers = {
      'User-Agent': 'RepoLens-AI-Architecture-Visualizer',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (config.githubToken) {
      headers['Authorization'] = `Bearer ${config.githubToken}`;
    }

    const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      // 403 (rate limit), 404, or other error: skip pre-check and let git clone + post-check handle it
      return { allowed: true, skipped: true };
    }

    const data = await response.json();
    if (typeof data.size === 'number') {
      const sizeMb = data.size / 1024;
      if (sizeMb > maxSizeMb) {
        return {
          allowed: false,
          sizeMb: Math.round(sizeMb),
          reason: `Repository size (~${Math.round(sizeMb)}MB) exceeds the maximum allowed limit of ${maxSizeMb}MB.`,
        };
      }
      return { allowed: true, sizeMb: Math.round(sizeMb) };
    }

    return { allowed: true, skipped: true };
  } catch (_err) {
    // Network or timeout failure on GitHub API: continue to clone without failing early
    return { allowed: true, skipped: true };
  }
};

/**
 * Validates remote repository accessibility via git ls-remote without terminal prompt hanging.
 *
 * @param {string} normalizedUrl
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export const validateRemote = async (normalizedUrl, timeoutMs = 15000) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const git = simpleGit({
      abort: controller.signal,
      spawnOptions: {
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: 'echo',
        },
      },
    });

    const remoteInfo = await git.listRemote(['--', normalizedUrl]);
    return Boolean(remoteInfo && remoteInfo.trim() !== '');
  } catch (_err) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Walks directory without following symlinks and enforces file count and size limits.
 *
 * @param {string} dirPath
 * @param {number} maxFiles
 * @param {number} maxSizeMb
 * @returns {Promise<{ withinLimits: boolean, totalFiles: number, totalBytes: number, code?: number, error?: string }>}
 */
export const checkLocalRepoLimits = async (dirPath, maxFiles = config.maxRepoFiles, maxSizeMb = config.maxRepoSizeMb) => {
  let totalFiles = 0;
  let totalBytes = 0;
  const maxBytes = maxSizeMb * 1024 * 1024;

  const walk = async (currentDir) => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip the .git directory completely when inspecting repo contents
      if (entry.name === '.git') continue;

      const fullPath = path.join(currentDir, entry.name);

      // Inspect with lstat so we never follow symlinks
      const stats = await fs.lstat(fullPath);

      if (stats.isSymbolicLink()) {
        // Skip following symlink targets
        continue;
      }

      if (stats.isDirectory()) {
        await walk(fullPath);
      } else if (stats.isFile()) {
        totalFiles += 1;
        totalBytes += stats.size;

        if (totalFiles > maxFiles) {
          throw {
            code: 422,
            error: `Repository exceeds maximum file count limit of ${maxFiles} files.`,
          };
        }

        if (totalBytes > maxBytes) {
          throw {
            code: 413,
            error: `Repository size exceeds maximum allowed limit of ${maxSizeMb}MB.`,
          };
        }
      }
    }
  };

  try {
    await walk(dirPath);
    return { withinLimits: true, totalFiles, totalBytes };
  } catch (err) {
    if (err.code && err.error) {
      return { withinLimits: false, totalFiles, totalBytes, code: err.code, error: err.error };
    }
    throw err;
  }
};

/**
 * Clones repository with security flags, hard wall-clock timeout, and post-clone limits check.
 *
 * @param {{
 *   url: string,
 *   targetDir: string,
 *   cloneRoot?: string,
 *   timeoutMs?: number,
 *   maxFiles?: number,
 *   maxSizeMb?: number
 * }} params
 * @returns {Promise<{ success: boolean, targetDir: string, totalFiles: number, totalBytes: number }>}
 */
export const cloneRepositorySafely = async ({
  url,
  targetDir,
  cloneRoot = config.cloneRoot,
  timeoutMs = config.cloneTimeoutMs,
  maxFiles = config.maxRepoFiles,
  maxSizeMb = config.maxRepoSizeMb,
}) => {
  const pathCheck = assertSafePath(targetDir, cloneRoot);
  if (!pathCheck.isSafe) {
    const err = new Error(`Invalid clone target directory: ${pathCheck.error}`);
    err.code = 400;
    throw err;
  }

  const safeTargetDir = pathCheck.resolvedPath;

  // Clean existing targetDir if present before cloning
  await safeRemoveDir(safeTargetDir, cloneRoot);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let cloneSucceeded = false;

  try {
    const git = simpleGit({
      abort: controller.signal,
      config: [
        'core.symlinks=false',
        'protocol.file.allow=never',
      ],
      unsafe: {
        allowUnsafeProtocolOverride: true,
      },
      spawnOptions: {
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: 'echo',
        },
      },
    });

    await git.clone(url, safeTargetDir, [
      '--depth', '1',
      '--single-branch',
      '--no-tags',
      '--recurse-submodules=no',
      '--',
    ]);

    cloneSucceeded = true;

    // Enforce file count and disk limits after cloning
    const limits = await checkLocalRepoLimits(safeTargetDir, maxFiles, maxSizeMb);
    if (!limits.withinLimits) {
      const limitErr = new Error(limits.error);
      limitErr.code = limits.code || 413;
      throw limitErr;
    }

    return {
      success: true,
      targetDir: safeTargetDir,
      totalFiles: limits.totalFiles,
      totalBytes: limits.totalBytes,
    };

  } catch (err) {
    // If anything fails after or during directory creation, delete the partial/oversized clone
    try {
      await safeRemoveDir(safeTargetDir, cloneRoot);
    } catch (_cleanupErr) {
      // Best effort cleanup
    }

    if (controller.signal.aborted) {
      const timeoutErr = new Error(`Repository clone timed out after ${timeoutMs}ms.`);
      timeoutErr.code = 408;
      throw timeoutErr;
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export default {
  preCheckGitHubRepoSize,
  validateRemote,
  checkLocalRepoLimits,
  cloneRepositorySafely,
};
