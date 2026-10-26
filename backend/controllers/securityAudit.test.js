import { test, describe } from 'node:test';
import assert from 'node:assert';
import childProcess from 'node:child_process';
import mongoose from 'mongoose';
import { runSecurityAudit } from './analyzeController.js';
import Repository from '../models/Repository.js';

describe('Security Audit Endpoint Hardening', () => {
  test('proves no child process (npm, shell, or worker) is spawned by runSecurityAudit', async () => {
    let spawnCalled = false;
    let execCalled = false;
    let execFileCalled = false;
    let forkCalled = false;

    // Spy on child_process methods
    const originalSpawn = childProcess.spawn;
    const originalExec = childProcess.exec;
    const originalExecFile = childProcess.execFile;
    const originalFork = childProcess.fork;

    childProcess.spawn = () => { spawnCalled = true; throw new Error('Unsafe spawn called'); };
    childProcess.exec = () => { execCalled = true; throw new Error('Unsafe exec called'); };
    childProcess.execFile = () => { execFileCalled = true; throw new Error('Unsafe execFile called'); };
    childProcess.fork = () => { forkCalled = true; throw new Error('Unsafe fork called'); };

    // Mock Repository.findById
    const originalFindById = Repository.findById;
    const fakeRepoId = new mongoose.Types.ObjectId().toString();
    Repository.findById = async (id) => {
      if (id === fakeRepoId) {
        return { _id: fakeRepoId, localPath: 'cloned-repos/dummy' };
      }
      return null;
    };

    let responseStatus = null;
    let responseBody = null;

    const mockReq = {
      params: { repoId: fakeRepoId },
    };
    const mockRes = {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(data) {
        responseBody = data;
        return this;
      },
    };

    try {
      await runSecurityAudit(mockReq, mockRes);

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.available, false);
      assert.strictEqual(responseBody.auditFound, false);
      assert.strictEqual(responseBody.message, 'Security audit is temporarily unavailable while it is rebuilt.');

      assert.strictEqual(spawnCalled, false, 'child_process.spawn must NOT be called');
      assert.strictEqual(execCalled, false, 'child_process.exec must NOT be called');
      assert.strictEqual(execFileCalled, false, 'child_process.execFile must NOT be called');
      assert.strictEqual(forkCalled, false, 'child_process.fork must NOT be called');
    } finally {
      // Restore mocks
      childProcess.spawn = originalSpawn;
      childProcess.exec = originalExec;
      childProcess.execFile = originalExecFile;
      childProcess.fork = originalFork;
      Repository.findById = originalFindById;
    }
  });

  test('returns 400 for invalid ObjectId format without spawning processes', async () => {
    let responseStatus = null;
    let responseBody = null;

    const mockReq = { params: { repoId: 'invalid-id-format' } };
    const mockRes = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseBody = data; return this; },
    };

    await runSecurityAudit(mockReq, mockRes);
    assert.strictEqual(responseStatus, 400);
    assert.strictEqual(responseBody.error, 'Invalid repository ID format.');
  });
});
