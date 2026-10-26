import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { runCleanupSweep } from './cleanupService.js';

describe('Cleanup Sweep Service (runCleanupSweep)', () => {
  let tempRoot;

  test('cleans up expired directories and orphans correctly with injected clock and dbLookup', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-cleanup-test-'));

    try {
      const activeRepoDir = path.join(tempRoot, '69e35eaeaf6204966a6d8de5-active');
      const expiredRepoDir = path.join(tempRoot, '69e35eaeaf6204966a6d8de6-expired');
      const orphanRepoDir = path.join(tempRoot, '69e35eaeaf6204966a6d8de7-orphan');

      await fs.mkdir(activeRepoDir, { recursive: true });
      await fs.mkdir(expiredRepoDir, { recursive: true });
      await fs.mkdir(orphanRepoDir, { recursive: true });

      // Put files inside them
      await fs.writeFile(path.join(activeRepoDir, 'file.txt'), 'active');
      await fs.writeFile(path.join(expiredRepoDir, 'file.txt'), 'expired');
      await fs.writeFile(path.join(orphanRepoDir, 'file.txt'), 'orphan');

      const now = 1700000000000;
      const ttlHours = 24;
      const ttlMs = ttlHours * 60 * 60 * 1000;

      // Set mtimes:
      // active: 1 hour ago
      const activeTime = new Date(now - 1 * 60 * 60 * 1000);
      await fs.utimes(activeRepoDir, activeTime, activeTime);

      // expired: 25 hours ago (> 24 hours TTL)
      const expiredTime = new Date(now - 25 * 60 * 60 * 1000);
      await fs.utimes(expiredRepoDir, expiredTime, expiredTime);

      // orphan: 2 hours ago (within TTL, but no DB record)
      const orphanTime = new Date(now - 2 * 60 * 60 * 1000);
      await fs.utimes(orphanRepoDir, orphanTime, orphanTime);

      const dbLookup = async (dirName) => {
        // Only activeRepoDir has an active record
        return dirName.includes('active');
      };

      const result = await runCleanupSweep({
        cloneRoot: tempRoot,
        ttlHours,
        clock: () => now,
        dbLookup,
      });

      assert.equal(result.scanned, 3);
      assert.equal(result.deletedExpired, 1);
      assert.equal(result.deletedOrphaned, 1);
      assert.equal(result.errors, 0);

      // Active repo directory should still exist
      const activeStat = await fs.stat(activeRepoDir);
      assert.ok(activeStat.isDirectory());

      // Expired repo directory should be removed
      await assert.rejects(async () => fs.stat(expiredRepoDir), /ENOENT/);

      // Orphan repo directory should be removed
      await assert.rejects(async () => fs.stat(orphanRepoDir), /ENOENT/);

    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('handles empty cloneRoot gracefully without errors', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-cleanup-empty-'));

    try {
      const result = await runCleanupSweep({
        cloneRoot: tempRoot,
        ttlHours: 24,
        clock: () => Date.now(),
        dbLookup: async () => true,
      });

      assert.equal(result.scanned, 0);
      assert.equal(result.deletedExpired, 0);
      assert.equal(result.deletedOrphaned, 0);
      assert.equal(result.errors, 0);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  });
});
