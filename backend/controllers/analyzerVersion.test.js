import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import fsPromises from 'fs/promises';
import mongoose from 'mongoose';
import { getGraphData, inFlightGraphs } from './analyzeController.js';
import Repository from '../models/Repository.js';
import config from '../utils/config.js';

describe('Analyzer Versioning & Stale Record Migration', () => {
  test('returns cached graph and metrics without recompute when analyzerVersion is current', async () => {
    const fakeRepoId = new mongoose.Types.ObjectId().toString();
    const originalFindById = Repository.findById;

    Repository.findById = async (id) => {
      if (id === fakeRepoId) {
        return {
          _id: fakeRepoId,
          url: 'https://github.com/cached-owner/cached-repo',
          analyzerVersion: config.analyzerVersion,
          graphData: {
            nodes: [{ id: 'src/index.js' }],
            edges: [],
            circular: [],
          },
          metrics: {
            files: { total: 1 },
          },
          analysis: {
            analyzerVersion: config.analyzerVersion,
          },
        };
      }
      return null;
    };

    let responseStatus = null;
    let responseBody = null;
    const mockReq = { params: { repoId: fakeRepoId } };
    const mockRes = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseBody = data; return this; },
    };

    try {
      await getGraphData(mockReq, mockRes);

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(responseBody.nodes.length, 1);
      assert.strictEqual(responseBody.nodes[0].id, 'src/index.js');
      assert.strictEqual(responseBody.metrics.files.total, 1);
      assert.deepStrictEqual(responseBody.repo, {
        url: 'https://github.com/cached-owner/cached-repo',
        owner: 'cached-owner',
        name: 'cached-repo',
      });
      assert.ok(responseBody.metricDefinitions);
      assert.ok(responseBody.metricDefinitions['files.total']);
    } finally {
      Repository.findById = originalFindById;
    }
  });

  test('triggers recompute when analyzerVersion is stale (0) and updates record with current version and real metrics', async () => {
    const fakeRepoId = new mongoose.Types.ObjectId().toString();
    const testCloneDir = path.resolve(config.cloneRoot, `${fakeRepoId}-test-migration`);
    await fsPromises.mkdir(testCloneDir, { recursive: true });
    await fsPromises.writeFile(path.join(testCloneDir, 'index.js'), 'console.log("migration test");\n', 'utf8');

    const originalFindById = Repository.findById;
    let saved = false;

    const mockRepoDoc = {
      _id: fakeRepoId,
      url: 'https://github.com/test-owner/test-migration',
      localPath: testCloneDir,
      analyzerVersion: 0, // Stale old version
      graphData: {
        nodes: [{ id: 'old-fake-node.js' }],
        edges: [],
        circular: [],
      },
      metrics: {
        complexityScore: 85, // Old fake metric
      },
      analysis: {},
      save: async () => {
        saved = true;
      },
    };

    Repository.findById = async (id) => {
      if (id === fakeRepoId) return mockRepoDoc;
      return null;
    };

    let responseStatus = null;
    let responseBody = null;
    const mockReq = { params: { repoId: fakeRepoId } };
    const mockRes = {
      set() {},
      status(code) { responseStatus = code; return this; },
      json(data) { responseBody = data; return this; },
    };

    try {
      inFlightGraphs.delete(fakeRepoId);
      await getGraphData(mockReq, mockRes);

      assert.strictEqual(responseStatus, 200);
      assert.strictEqual(saved, true, 'Must persist recomputed record to database');
      assert.strictEqual(mockRepoDoc.analyzerVersion, config.analyzerVersion, 'Must update analyzerVersion to current');
      assert.strictEqual(mockRepoDoc.metrics.files.total, 1);
      assert.strictEqual(mockRepoDoc.metrics.complexityScore, undefined, 'Old fake metric must be gone');
      assert.strictEqual(responseBody.nodes[0].id, 'index.js');
      assert.deepStrictEqual(responseBody.repo, {
        url: 'https://github.com/test-owner/test-migration',
        owner: 'test-owner',
        name: 'test-migration',
      });
      assert.ok(responseBody.metricDefinitions);
      assert.ok(responseBody.metricDefinitions['loc.total']);
    } finally {
      Repository.findById = originalFindById;
      inFlightGraphs.delete(fakeRepoId);
      await fsPromises.rm(testCloneDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
