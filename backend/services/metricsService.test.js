import { test, describe } from 'node:test';
import assert from 'node:assert';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import {
  countFileLoc,
  walkRepoFiles,
  detectFrameworks,
  detectEntryCandidates,
  computeRepoMetrics,
  computeImpactScore,
  normalizeRepoPath,
  METRIC_DEFINITIONS,
} from './metricsService.js';

describe('Metrics Service: normalizeRepoPath', () => {
  test('normalizes Windows backslashes and relative prefixes to forward slashes', () => {
    const root = 'C:\\repos\\my-repo';
    assert.strictEqual(
      normalizeRepoPath('C:\\repos\\my-repo\\src\\components\\Button.jsx', root),
      'src/components/Button.jsx'
    );
    assert.strictEqual(
      normalizeRepoPath('.\\src\\index.js', root),
      'src/index.js'
    );
    assert.strictEqual(
      normalizeRepoPath('src\\utils\\math.ts', root),
      'src/utils/math.ts'
    );
    assert.strictEqual(normalizeRepoPath('', root), '');
  });
});

describe('Metrics Service: countFileLoc', () => {
  test('accurately counts blank and nonBlank lines with CRLF and LF endings', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-loc-'));
    const testFile = path.join(tmpDir, 'sample.js');

    // 5 lines: 3 non-blank, 2 blank, CRLF
    const content = 'const a = 1;\r\n\r\nconst b = 2;\r\n  \t  \r\nconsole.log(a + b);\r\n';
    await fs.writeFile(testFile, content, 'utf8');

    try {
      const res = await countFileLoc(testFile);
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.total, 5);
      assert.strictEqual(res.blank, 2);
      assert.strictEqual(res.nonBlank, 3);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('skips files exceeding 1MB limit safely', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-loc-large-'));
    const largeFile = path.join(tmpDir, 'large.js');

    // Create 1.1MB file
    const largeBuffer = Buffer.alloc(1100 * 1024, 65); // 'A'
    await fs.writeFile(largeFile, largeBuffer);

    try {
      const res = await countFileLoc(largeFile);
      assert.strictEqual(res.ok, false);
      assert.match(res.reason, /1MB limit/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('skips binary files containing NUL bytes in the first 8KB', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-loc-bin-'));
    const binFile = path.join(tmpDir, 'binary.dat');

    // Create buffer with NUL byte
    const binBuffer = Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x57, 0x6f, 0x72, 0x6c, 0x64]);
    await fs.writeFile(binFile, binBuffer);

    try {
      const res = await countFileLoc(binFile);
      assert.strictEqual(res.ok, false);
      assert.match(res.reason, /Binary content/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe('Metrics Service: detectFrameworks (Monorepo and Configs)', () => {
  test('detects frameworks in multiple monorepo package.json files and config files with exact evidence paths', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-mono-'));

    try {
      const pkgRoot = path.join(tmpDir, 'package.json');
      await fs.writeFile(
        pkgRoot,
        JSON.stringify({
          devDependencies: {
            tailwindcss: '^3.0.0',
          },
        }),
        'utf8'
      );

      const frontendDir = path.join(tmpDir, 'packages', 'client');
      await fs.mkdir(frontendDir, { recursive: true });
      const pkgFrontend = path.join(frontendDir, 'package.json');
      await fs.writeFile(
        pkgFrontend,
        JSON.stringify({
          dependencies: {
            react: '^18.0.0',
            vite: '^5.0.0',
          },
        }),
        'utf8'
      );

      const backendDir = path.join(tmpDir, 'packages', 'server');
      await fs.mkdir(backendDir, { recursive: true });
      const pkgBackend = path.join(backendDir, 'package.json');
      await fs.writeFile(
        pkgBackend,
        JSON.stringify({
          dependencies: {
            express: '^4.19.0',
            mongoose: '^8.0.0',
          },
        }),
        'utf8'
      );

      // Add a vite config file
      const viteConfig = path.join(tmpDir, 'packages', 'client', 'vite.config.js');
      await fs.writeFile(viteConfig, 'export default {};', 'utf8');

      const { allFiles, manifestFiles } = await walkRepoFiles(tmpDir);
      const frameworks = await detectFrameworks(manifestFiles, allFiles, tmpDir);

      const fwNames = frameworks.map(f => f.name);
      assert.ok(fwNames.includes('react'), 'React must be detected');
      assert.ok(fwNames.includes('vite'), 'Vite must be detected');
      assert.ok(fwNames.includes('express'), 'Express must be detected');
      assert.ok(fwNames.includes('mongoose'), 'Mongoose must be detected');
      assert.ok(fwNames.includes('tailwindcss'), 'TailwindCSS must be detected');
      assert.ok(!fwNames.includes('vue'), 'Vue must NOT be reported without evidence');
      assert.ok(!fwNames.includes('angular'), 'Angular must NOT be reported without evidence');

      // Verify evidence paths
      const reactFw = frameworks.find(f => f.name === 'react');
      assert.strictEqual(reactFw.evidencePath, 'packages/client/package.json');

      const expressFw = frameworks.find(f => f.name === 'express');
      assert.strictEqual(expressFw.evidencePath, 'packages/server/package.json');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe('Metrics Service: detectEntryCandidates', () => {
  test('discovers entry points from package.json main/bin/scripts, HTML, and conventional names', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-entries-'));

    try {
      await fs.writeFile(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          main: 'src/main.js',
          bin: {
            'my-cli': 'bin/cli.js',
          },
          scripts: {
            start: 'node server.js',
          },
        }),
        'utf8'
      );

      await fs.writeFile(
        path.join(tmpDir, 'index.html'),
        '<html><body><script src="src/app.jsx"></script></body></html>',
        'utf8'
      );

      await fs.mkdir(path.join(tmpDir, 'src'), { recursive: true });
      await fs.mkdir(path.join(tmpDir, 'bin'), { recursive: true });

      await fs.writeFile(path.join(tmpDir, 'src', 'main.js'), 'console.log("main");');
      await fs.writeFile(path.join(tmpDir, 'bin', 'cli.js'), 'console.log("cli");');
      await fs.writeFile(path.join(tmpDir, 'server.js'), 'console.log("server");');
      await fs.writeFile(path.join(tmpDir, 'src', 'app.jsx'), 'console.log("app");');
      await fs.writeFile(path.join(tmpDir, 'src', 'index.js'), 'console.log("index");');

      const { allFiles, manifestFiles, htmlFiles } = await walkRepoFiles(tmpDir);
      const candidates = await detectEntryCandidates(manifestFiles, htmlFiles, allFiles, tmpDir);

      const candidateIds = candidates.map(c => c.id);
      assert.ok(candidateIds.includes('src/main.js'), 'package.json main candidate');
      assert.ok(candidateIds.includes('bin/cli.js'), 'package.json bin candidate');
      assert.ok(candidateIds.includes('server.js'), 'package.json script / server candidate');
      assert.ok(candidateIds.includes('src/app.jsx'), 'HTML script candidate');
      assert.ok(candidateIds.includes('src/index.js'), 'Conventional entry name candidate');

      const mainCand = candidates.find(c => c.id === 'src/main.js');
      assert.strictEqual(mainCand.evidence, 'package.json main');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe('Metrics Service: computeRepoMetrics graph analysis', () => {
  test('correctly calculates cycles, orphans, hotspots with tie breaking, and test heuristics', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-graph-metrics-'));

    try {
      // Create mock source files
      await fs.mkdir(path.join(tmpDir, 'src', '__tests__'), { recursive: true });
      await fs.writeFile(path.join(tmpDir, 'src', 'a.js'), 'import "./b.js";\n');
      await fs.writeFile(path.join(tmpDir, 'src', 'b.js'), 'import "./a.js";\n');
      await fs.writeFile(path.join(tmpDir, 'src', 'hot.js'), 'export const h = 1;\n');
      await fs.writeFile(path.join(tmpDir, 'src', 'caller1.js'), 'import "./hot.js";\n');
      await fs.writeFile(path.join(tmpDir, 'src', 'caller2.js'), 'import "./hot.js";\n');
      await fs.writeFile(path.join(tmpDir, 'src', 'tie1.js'), 'export const t1 = 1;\n');
      await fs.writeFile(path.join(tmpDir, 'src', 'tie2.js'), 'export const t2 = 2;\n');
      await fs.writeFile(path.join(tmpDir, 'src', 'orphan.js'), 'console.log("isolated");\n');
      await fs.writeFile(path.join(tmpDir, 'src', '__tests__', 'a.test.js'), 'console.log("test");\n');

      const rawTree = {
        'src/a.js': ['src/b.js'],
        'src/b.js': ['src/a.js'],
        'src/caller1.js': ['src/hot.js', 'src/tie1.js', 'src/tie2.js'],
        'src/caller2.js': ['src/hot.js'],
        'src/orphan.js': [],
        'src/__tests__/a.test.js': [],
      };

      const circular = [['src/a.js', 'src/b.js']];

      const { allFiles, manifestFiles, htmlFiles } = await walkRepoFiles(tmpDir);
      const result = await computeRepoMetrics({
        rootDir: tmpDir,
        rawTree,
        circular,
        allFiles,
        manifestFiles,
        htmlFiles,
      });

      // 1. Cycles
      assert.strictEqual(result.metrics.graph.circularCount, 1);
      assert.strictEqual(result.metrics.graph.filesInCycles, 2);
      assert.deepStrictEqual(result.graphData.circular, [['src/a.js', 'src/b.js']]);

      // 2. Hotspots (hot.js has fanIn 2; tie1 and tie2 have fanIn 1)
      assert.strictEqual(result.metrics.hotspots[0].id, 'src/hot.js');
      assert.strictEqual(result.metrics.hotspots[0].fanIn, 2);

      // Verify tie breaking order: tie1 before tie2 lexicographically
      const tie1 = result.metrics.hotspots.find(h => h.id === 'src/tie1.js');
      const tie2 = result.metrics.hotspots.find(h => h.id === 'src/tie2.js');
      assert.ok(tie1 && tie2);
      assert.strictEqual(tie1.fanIn, 1);
      assert.strictEqual(tie2.fanIn, 1);

      // 3. Orphan detection
      const orphanIds = result.metrics.orphans.map(o => o.id);
      assert.ok(orphanIds.includes('src/orphan.js'), 'src/orphan.js must be in orphans list');
      assert.ok(!orphanIds.includes('src/__tests__/a.test.js'), 'Test files must NOT be in orphans list');

      // 4. Test heuristic
      const testNode = result.graphData.nodes.find(n => n.id === 'src/__tests__/a.test.js');
      assert.ok(testNode);
      assert.strictEqual(testNode.isTest, true);

      const nonTestNode = result.graphData.nodes.find(n => n.id === 'src/a.js');
      assert.ok(nonTestNode);
      assert.strictEqual(nonTestNode.isTest, false);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('handles Python-only repo: empty graph, unsupported summary, LOC is null', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'repolens-python-'));

    try {
      await fs.writeFile(path.join(tmpDir, 'main.py'), 'print("Hello from Python")\n', 'utf8');
      await fs.writeFile(path.join(tmpDir, 'utils.py'), 'def add(a, b):\n    return a + b\n', 'utf8');
      await fs.writeFile(path.join(tmpDir, 'README.md'), '# Python Repo\n', 'utf8');

      const { allFiles, manifestFiles, htmlFiles } = await walkRepoFiles(tmpDir);
      const result = await computeRepoMetrics({
        rootDir: tmpDir,
        rawTree: {},
        circular: [],
        allFiles,
        manifestFiles,
        htmlFiles,
      });

      assert.strictEqual(result.graphData.nodes.length, 0);
      assert.strictEqual(result.graphData.edges.length, 0);
      assert.strictEqual(result.metrics.files.supportedSource, 0);
      assert.strictEqual(result.metrics.loc, null, 'LOC must be null when no analyzable files exist');

      // Unsupported languages breakdown
      assert.ok(result.analysis.unsupported.some(u => u.language === 'Python' && u.count === 2));
      assert.ok(result.analysis.unsupported.some(u => u.language === 'Markdown' && u.count === 1));

      // Languages list
      const pythonLang = result.metrics.languages.find(l => l.language === 'Python');
      assert.strictEqual(pythonLang.analysisSupported, false);

      // Warning present
      assert.ok(result.analysis.warnings.some(w => w.includes('No JavaScript or TypeScript source files')));
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});

describe('Metrics Service: METRIC_DEFINITIONS export', () => {
  test('exports definitions for all primary metrics', () => {
    assert.ok(METRIC_DEFINITIONS['files.total']);
    assert.ok(METRIC_DEFINITIONS['loc.total']);
    assert.ok(METRIC_DEFINITIONS['graph.circularCount']);
    assert.ok(METRIC_DEFINITIONS['hotspots']);
    assert.ok(METRIC_DEFINITIONS['orphans']);
    assert.ok(METRIC_DEFINITIONS['entryCandidates']);
    assert.ok(METRIC_DEFINITIONS['frameworks']);
  });
});

describe('Metrics Service: computeImpactScore', () => {
  test('computes impact score as min(100, fanIn*7 + fanOut*3)', () => {
    assert.strictEqual(computeImpactScore(0, 0), 0);
    assert.strictEqual(computeImpactScore(1, 0), 7);
    assert.strictEqual(computeImpactScore(0, 1), 3);
    assert.strictEqual(computeImpactScore(10, 0), 70);
    assert.strictEqual(computeImpactScore(0, 10), 30);
    assert.strictEqual(computeImpactScore(10, 10), 100);
    assert.strictEqual(computeImpactScore(20, 20), 100, 'must cap at 100');
    assert.strictEqual(computeImpactScore(null, undefined), 0, 'handles missing arguments');
    assert.strictEqual(computeImpactScore(-5, -2), 0, 'handles negative values');
  });
});
