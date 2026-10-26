import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import {
  runWorkerGraphExtraction,
  analyzeRepositoryGraph,
} from './graphAnalyzer.js';

describe('Graph Analyzer Worker Isolation and Timeout', () => {
  test('terminates CPU-bound infinite loop worker and rejects with ANALYSIS_TIMEOUT', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-timeout-'));
    const infiniteWorkerFile = path.join(tmpDir, 'infiniteWorker.js');

    // Worker script with CPU-bound infinite loop
    await fs.writeFile(
      infiniteWorkerFile,
      `
      // Busy loop consuming CPU
      while (true) {}
      `,
      'utf8'
    );

    try {
      await assert.rejects(
        runWorkerGraphExtraction({
          targetDir: tmpDir,
          workerScriptPath: infiniteWorkerFile,
          timeoutMs: 150, // Short timeout
        }),
        (err) => {
          assert.strictEqual(err.code, 'ANALYSIS_TIMEOUT');
          assert.strictEqual(err.statusCode, 504);
          assert.match(err.message, /timed out/);
          return true;
        }
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('catches worker crash on unexpected exit and rejects with safe error', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-crash-'));
    const crashWorkerFile = path.join(tmpDir, 'crashWorker.js');

    // Worker script that exits abnormally
    await fs.writeFile(
      crashWorkerFile,
      `
      process.exit(42);
      `,
      'utf8'
    );

    try {
      await assert.rejects(
        runWorkerGraphExtraction({
          targetDir: tmpDir,
          workerScriptPath: crashWorkerFile,
          timeoutMs: 2000,
        }),
        (err) => {
          assert.strictEqual(err.code, 'WORKER_CRASHED');
          assert.match(err.message, /exit code 42/);
          return true;
        }
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('handles worker unhandled exception gracefully', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-error-'));
    const errorWorkerFile = path.join(tmpDir, 'errorWorker.js');

    // Worker script that throws unhandled error
    await fs.writeFile(
      errorWorkerFile,
      `
      throw new Error('Fatal worker memory corruption');
      `,
      'utf8'
    );

    try {
      await assert.rejects(
        runWorkerGraphExtraction({
          targetDir: tmpDir,
          workerScriptPath: errorWorkerFile,
          timeoutMs: 2000,
        }),
        (err) => {
          assert.strictEqual(err.code, 'WORKER_ERROR');
          assert.match(err.message, /crashed/);
          return true;
        }
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('handles worker out-of-memory termination with memory limit', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-oom-'));
    const oomWorkerFile = path.join(tmpDir, 'oomWorker.js');

    // Worker script that rapidly allocates memory to exceed maxOldGenerationSizeMb
    await fs.writeFile(
      oomWorkerFile,
      `
      const buffers = [];
      while (true) {
        buffers.push(Buffer.alloc(10 * 1024 * 1024));
      }
      `,
      'utf8'
    );

    try {
      await assert.rejects(
        runWorkerGraphExtraction({
          targetDir: tmpDir,
          workerScriptPath: oomWorkerFile,
          maxMemoryMb: 16, // Very low 16MB heap limit
          timeoutMs: 5000,
        }),
        (err) => {
          // In Node.js, V8 heap exhaustion either triggers worker error or non-zero exit code
          assert.ok(
            err.code === 'WORKER_ERROR' || err.code === 'WORKER_CRASHED' || err.code === 'ANALYSIS_TIMEOUT',
            `Expected worker failure due to OOM, got ${err.code}: ${err.message}`
          );
          return true;
        }
      );
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe('Graph Analyzer tsconfig integration', () => {
  test('resolves tsconfig path aliases correctly when valid tsconfig exists', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-tsconfig-'));

    try {
      // Create tsconfig with path aliases
      await fs.writeFile(
        path.join(tmpDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            baseUrl: '.',
            moduleResolution: 'node',
            paths: {
              '@utils/*': ['src/utils/*'],
            },
          },
        }, null, 2),
        'utf8'
      );

      await fs.mkdir(path.join(tmpDir, 'src', 'utils'), { recursive: true });
      await fs.writeFile(
        path.join(tmpDir, 'src', 'utils', 'helper.ts'),
        'export const add = (a: number, b: number): number => a + b;\n',
        'utf8'
      );
      await fs.writeFile(
        path.join(tmpDir, 'src', 'index.ts'),
        'import { add } from "@utils/helper";\nconsole.log(add(1, 2));\n',
        'utf8'
      );

      const result = await analyzeRepositoryGraph({ targetDir: tmpDir });

      assert.ok(result.graphData);
      assert.ok(result.graphData.nodes.length >= 2, `Expected at least 2 nodes, got ${result.graphData.nodes.length}`);

      const nodeIds = result.graphData.nodes.map(n => n.id);
      assert.ok(nodeIds.includes('src/index.ts'), 'Expected src/index.ts node');
      assert.ok(nodeIds.includes('src/utils/helper.ts'), 'Expected src/utils/helper.ts node via alias');

      // Verify edge resolved
      const hasAliasEdge = result.graphData.edges.some(
        e => e.source === 'src/index.ts' && e.target === 'src/utils/helper.ts'
      );
      assert.ok(hasAliasEdge, 'Expected edge from src/index.ts to src/utils/helper.ts');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('records warning and continues without failing when tsconfig.json is malformed', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-bad-tsconfig-'));

    try {
      // Write malformed JSON
      await fs.writeFile(
        path.join(tmpDir, 'tsconfig.json'),
        '{ "compilerOptions": { "baseUrl": invalid_json here',
        'utf8'
      );

      await fs.writeFile(
        path.join(tmpDir, 'index.js'),
        'import { something } from "./local.js";\n',
        'utf8'
      );
      await fs.writeFile(
        path.join(tmpDir, 'local.js'),
        'export const something = 42;\n',
        'utf8'
      );

      const result = await analyzeRepositoryGraph({ targetDir: tmpDir });

      assert.ok(result.graphData);
      assert.ok(result.analysis);
      assert.ok(
        result.analysis.warnings.some(w => w.includes('tsconfig.json at root could not be parsed')),
        'Expected warning about unparseable tsconfig'
      );
      assert.strictEqual(result.graphData.nodes.length, 2);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
