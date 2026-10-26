import path from 'path';
import fs from 'fs/promises';

/**
 * Validates that candidatePath is strictly inside cloneRoot (a direct or nested child, NOT the root itself).
 * Handles Windows case-insensitivity, path separators, and prevents sibling-prefix directory attacks.
 *
 * @param {string} candidatePath - Path to test
 * @param {string} cloneRoot - Expected root directory
 * @returns {{ isSafe: boolean, resolvedPath?: string, error?: string }}
 */
export const assertSafePath = (candidatePath, cloneRoot) => {
  if (!candidatePath || typeof candidatePath !== 'string') {
    return { isSafe: false, error: 'Candidate path is required.' };
  }
  if (!cloneRoot || typeof cloneRoot !== 'string') {
    return { isSafe: false, error: 'Clone root directory is required.' };
  }

  const resolvedRoot = path.resolve(cloneRoot);
  const resolvedCandidate = path.resolve(candidatePath);

  const isWindows = process.platform === 'win32';
  const rootComp = isWindows ? resolvedRoot.toLowerCase() : resolvedRoot;
  const candComp = isWindows ? resolvedCandidate.toLowerCase() : resolvedCandidate;

  // Reject the root itself
  if (rootComp === candComp) {
    return { isSafe: false, error: 'Path cannot be the clone root itself.' };
  }

  // Calculate relative path from root to candidate
  const rel = path.relative(resolvedRoot, resolvedCandidate);

  // If rel starts with '..' or is absolute, it is outside the root
  if (rel.startsWith('..') || path.isAbsolute(rel) || rel === '') {
    return { isSafe: false, error: 'Path traversal detected outside clone root.' };
  }

  // Check prefix with path separator to prevent sibling directory attacks (e.g. /cloned-repos-evil)
  const expectedPrefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  const expectedPrefixComp = isWindows ? expectedPrefix.toLowerCase() : expectedPrefix;

  if (!candComp.startsWith(expectedPrefixComp)) {
    return { isSafe: false, error: 'Path is not inside clone root.' };
  }

  return { isSafe: true, resolvedPath: resolvedCandidate };
};

/**
 * Safely removes a directory inside cloneRoot with retries for Windows file lock contention (EBUSY, EPERM, ENOTEMPTY).
 *
 * @param {string} targetPath - Path to remove
 * @param {string} cloneRoot - Allowed root directory
 * @param {number} maxRetries - Max retry attempts (default: 5)
 * @param {number} delayMs - Delay between retries in ms (default: 200)
 */
export const safeRemoveDir = async (targetPath, cloneRoot, maxRetries = 5, delayMs = 200) => {
  const check = assertSafePath(targetPath, cloneRoot);
  if (!check.isSafe) {
    throw new Error(`Unsafe deletion rejected: ${check.error}`);
  }

  const safePath = check.resolvedPath;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await fs.rm(safePath, { recursive: true, force: true });
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        return true; // Already deleted
      }
      if ((err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'ENOTEMPTY') && attempt < maxRetries) {
        await new Promise(res => setTimeout(res, delayMs * attempt));
        continue;
      }
      throw err;
    }
  }
};
