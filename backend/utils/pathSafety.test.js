import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { assertSafePath, safeRemoveDir } from './pathSafety.js';

describe('Path Safety Utility (assertSafePath)', () => {
  const rootDir = path.resolve('test-cloned-repos');

  test('accepts a direct child directory within root', () => {
    const candidate = path.join(rootDir, 'repo-123');
    const result = assertSafePath(candidate, rootDir);
    assert.equal(result.isSafe, true);
    assert.equal(result.resolvedPath, path.resolve(candidate));
  });

  test('accepts nested paths within root', () => {
    const candidate = path.join(rootDir, 'repo-123', 'subfolder', 'file.txt');
    const result = assertSafePath(candidate, rootDir);
    assert.equal(result.isSafe, true);
    assert.equal(result.resolvedPath, path.resolve(candidate));
  });

  test('rejects the clone root itself', () => {
    const result = assertSafePath(rootDir, rootDir);
    assert.equal(result.isSafe, false);
    assert.match(result.error, /cannot be the clone root itself/i);
  });

  test('rejects parent traversal using ..', () => {
    const candidate = path.join(rootDir, '..', 'other-folder');
    const result = assertSafePath(candidate, rootDir);
    assert.equal(result.isSafe, false);
    assert.match(result.error, /traversal/i);
  });

  test('rejects path escaping root inside a subdirectory using ../..', () => {
    const candidate = path.join(rootDir, 'sub', '..', '..', 'escaped');
    const result = assertSafePath(candidate, rootDir);
    assert.equal(result.isSafe, false);
    assert.match(result.error, /traversal/i);
  });

  test('rejects absolute paths outside root', () => {
    const candidate = process.platform === 'win32' ? 'C:\\Windows\\System32' : '/etc/passwd';
    const result = assertSafePath(candidate, rootDir);
    assert.equal(result.isSafe, false);
  });

  test('rejects sibling prefix directory attacks (e.g. cloned-repos-evil)', () => {
    // Sibling directory that starts with the same characters as rootDir
    const evilSibling = path.resolve(rootDir + '-evil', 'malicious');
    const result = assertSafePath(evilSibling, rootDir);
    assert.equal(result.isSafe, false);
  });

  test('handles Windows case-insensitivity gracefully', () => {
    if (process.platform === 'win32') {
      const upperRoot = rootDir.toUpperCase();
      const lowerCandidate = path.join(rootDir.toLowerCase(), 'repo-abc');
      const result = assertSafePath(lowerCandidate, upperRoot);
      assert.equal(result.isSafe, true);

      // Root itself with different casing should still be rejected as root
      const rootSameCaseCheck = assertSafePath(rootDir.toLowerCase(), rootDir.toUpperCase());
      assert.equal(rootSameCaseCheck.isSafe, false);
    }
  });

  test('rejects null, undefined, or empty path inputs', () => {
    assert.equal(assertSafePath('', rootDir).isSafe, false);
    assert.equal(assertSafePath(null, rootDir).isSafe, false);
    assert.equal(assertSafePath(undefined, rootDir).isSafe, false);
    assert.equal(assertSafePath('repo-123', '').isSafe, false);
  });
});

describe('safeRemoveDir deletion safety', () => {
  test('rejects deletion of paths outside clone root', async () => {
    const rootDir = path.resolve('test-cloned-repos');
    await assert.rejects(
      async () => {
        await safeRemoveDir(path.resolve('other-folder'), rootDir);
      },
      /Unsafe deletion rejected/
    );
  });

  test('successfully removes directory within clone root', async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-test-root-'));
    try {
      const targetDir = path.join(tempRoot, 'repo-to-delete');
      await fs.mkdir(targetDir, { recursive: true });
      await fs.writeFile(path.join(targetDir, 'dummy.txt'), 'hello');

      const result = await safeRemoveDir(targetDir, tempRoot);
      assert.equal(result, true);

      // Verify directory no longer exists
      await assert.rejects(async () => {
        await fs.stat(targetDir);
      }, /ENOENT/);
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
    }
  });
});
