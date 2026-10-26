import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('In-flight Analysis Deduplication Logic', () => {
  test('concurrent requests for the same key share a single in-flight Promise', async () => {
    const inFlightMap = new Map();
    const testUrl = 'https://github.com/octocat/Hello-World';
    let executionCount = 0;

    const runAnalysisTask = async () => {
      if (inFlightMap.has(testUrl)) {
        return inFlightMap.get(testUrl);
      }

      const task = (async () => {
        try {
          executionCount++;
          // Simulate async cloning/analysis delay
          await new Promise(resolve => setTimeout(resolve, 50));
          return { success: true, repoId: 'test-123' };
        } finally {
          inFlightMap.delete(testUrl);
        }
      })();

      inFlightMap.set(testUrl, task);
      return task;
    };

    // Fire 3 concurrent requests simultaneously
    const [res1, res2, res3] = await Promise.all([
      runAnalysisTask(),
      runAnalysisTask(),
      runAnalysisTask(),
    ]);

    assert.equal(executionCount, 1, 'Only one actual clone/analysis task should have executed');
    assert.deepEqual(res1, { success: true, repoId: 'test-123' });
    assert.deepEqual(res2, { success: true, repoId: 'test-123' });
    assert.deepEqual(res3, { success: true, repoId: 'test-123' });
    assert.equal(inFlightMap.has(testUrl), false, 'Map should be cleared after completion');
  });

  test('clears in-flight map entry when task throws error', async () => {
    const inFlightMap = new Map();
    const testUrl = 'https://github.com/octocat/Broken-Repo';
    let executionCount = 0;

    const runFailingTask = async () => {
      if (inFlightMap.has(testUrl)) {
        return inFlightMap.get(testUrl);
      }

      const task = (async () => {
        try {
          executionCount++;
          await new Promise(resolve => setTimeout(resolve, 20));
          throw new Error('Clone timeout or network error');
        } finally {
          inFlightMap.delete(testUrl);
        }
      })();

      inFlightMap.set(testUrl, task);
      return task;
    };

    const results = await Promise.allSettled([
      runFailingTask(),
      runFailingTask(),
    ]);

    assert.equal(executionCount, 1);
    assert.equal(results[0].status, 'rejected');
    assert.equal(results[1].status, 'rejected');
    assert.equal(results[0].reason.message, 'Clone timeout or network error');
    assert.equal(results[1].reason.message, 'Clone timeout or network error');
    assert.equal(inFlightMap.has(testUrl), false, 'Map entry must be cleared on failure so subsequent requests can retry');
  });
});
