import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { checkLocalRepoLimits, cloneRepositorySafely } from './cloneService.js';

describe('Repository Limits Checker (checkLocalRepoLimits)', () => {
  let tempDir;

  test('passes for repository well within file count and size limits', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-limit-test-'));
    try {
      await fs.writeFile(path.join(tempDir, 'file1.js'), 'const a = 1;');
      await fs.writeFile(path.join(tempDir, 'file2.js'), 'const b = 2;');
      const subDir = path.join(tempDir, 'sub');
      await fs.mkdir(subDir);
      await fs.writeFile(path.join(subDir, 'file3.js'), 'const c = 3;');

      const result = await checkLocalRepoLimits(tempDir, 10, 5);
      assert.equal(result.withinLimits, true);
      assert.equal(result.totalFiles, 3);
      assert.ok(result.totalBytes > 0);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('fails and returns 422 when file count exceeds maxFiles limit', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-limit-test-'));
    try {
      // Create 5 files with maxFiles = 3
      for (let i = 1; i <= 5; i++) {
        await fs.writeFile(path.join(tempDir, `file_${i}.txt`), `content ${i}`);
      }

      const result = await checkLocalRepoLimits(tempDir, 3, 50);
      assert.equal(result.withinLimits, false);
      assert.equal(result.code, 422);
      assert.match(result.error, /maximum file count limit/i);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('fails and returns 413 when total byte size exceeds maxSizeMb limit', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-limit-test-'));
    try {
      // Create a file of 2MB with maxSizeMb = 1 (1MB)
      const twoMbBuffer = Buffer.alloc(2 * 1024 * 1024, 'x');
      await fs.writeFile(path.join(tempDir, 'large-file.dat'), twoMbBuffer);

      const result = await checkLocalRepoLimits(tempDir, 100, 1);
      assert.equal(result.withinLimits, false);
      assert.equal(result.code, 413);
      assert.match(result.error, /maximum allowed limit of 1MB/i);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('skips .git folder contents when counting files and sizes', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-limit-test-'));
    try {
      // Create 2 normal files
      await fs.writeFile(path.join(tempDir, 'index.js'), 'console.log("hello");');
      await fs.writeFile(path.join(tempDir, 'package.json'), '{}');

      // Create .git folder with multiple large files
      const gitDir = path.join(tempDir, '.git', 'objects');
      await fs.mkdir(gitDir, { recursive: true });
      await fs.writeFile(path.join(gitDir, 'gitpack1.pack'), Buffer.alloc(5 * 1024 * 1024, 'g'));
      await fs.writeFile(path.join(gitDir, 'gitpack2.pack'), Buffer.alloc(5 * 1024 * 1024, 'g'));

      // Limit maxFiles to 5, maxSizeMb to 2MB. Should pass because .git is ignored
      const result = await checkLocalRepoLimits(tempDir, 5, 2);
      assert.equal(result.withinLimits, true);
      assert.equal(result.totalFiles, 2);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe('cloneRepositorySafely cleanup and failure handling', () => {
  let tempRoot;

  test('aborts on forced clone timeout and leaves no partial directory behind', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-timeout-root-'));
    const targetDir = path.join(tempRoot, 'timeout-repo');

    try {
      await assert.rejects(
        async () => {
          await cloneRepositorySafely({
            url: 'https://github.com/octocat/Hello-World',
            targetDir,
            cloneRoot: tempRoot,
            timeoutMs: 1, // 1ms forced timeout
            maxFiles: 100,
            maxSizeMb: 50,
          });
        },
        (err) => {
          return err.code === 408 || /timed out/i.test(err.message) || /abort/i.test(err.message);
        }
      );

      // Verify that the partial directory was cleaned up and does not exist
      await assert.rejects(async () => fs.stat(targetDir), /ENOENT/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('rejects clone when post-check limits are exceeded and deletes directory', async () => {
    tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-overlimit-root-'));
    const targetDir = path.join(tempRoot, 'overlimit-repo');

    try {
      await assert.rejects(
        async () => {
          await cloneRepositorySafely({
            url: 'https://github.com/octocat/Hello-World',
            targetDir,
            cloneRoot: tempRoot,
            timeoutMs: 30000,
            maxFiles: 0, // 0 files allowed -> guaranteed rejection on clone
            maxSizeMb: 50,
          });
        },
        (err) => {
          return err.code === 422 || /maximum file count limit/i.test(err.message);
        }
      );

      // Verify that target directory was cleaned up and does not exist
      await assert.rejects(async () => fs.stat(targetDir), /ENOENT/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  });
});
