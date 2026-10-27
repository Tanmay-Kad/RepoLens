import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCOPE_CATEGORIES,
  classifyNodeScope,
  createDefaultScope,
  filterGraphByScope,
  formatScopeBanner,
  splitNodesByCategory,
} from './scopeModel.js';

describe('scopeModel: classifyNodeScope', () => {
  it('classifies nodes by whole path segment and never by substring', () => {
    // Substring contains "example" but is source file
    assert.equal(classifyNodeScope({ id: 'src/exampleParser.js' }), SCOPE_CATEGORIES.SOURCE);
    assert.equal(classifyNodeScope({ id: 'lib/myTestingUtils.js' }), SCOPE_CATEGORIES.SOURCE);
    assert.equal(classifyNodeScope({ id: 'src/benchmarkRunner.js' }), SCOPE_CATEGORIES.SOURCE);
    assert.equal(classifyNodeScope({ id: 'lib/docgen.js' }), SCOPE_CATEGORIES.SOURCE);

    // True directory segments
    assert.equal(classifyNodeScope({ id: 'examples/auth/index.js' }), SCOPE_CATEGORIES.EXAMPLE);
    assert.equal(classifyNodeScope({ id: 'example/basic.js' }), SCOPE_CATEGORIES.EXAMPLE);
    assert.equal(classifyNodeScope({ id: 'demo/app.js' }), SCOPE_CATEGORIES.EXAMPLE);
    assert.equal(classifyNodeScope({ id: 'samples/quickstart.js' }), SCOPE_CATEGORIES.EXAMPLE);

    assert.equal(classifyNodeScope({ id: 'test/app.listen.js' }), SCOPE_CATEGORIES.TEST);
    assert.equal(classifyNodeScope({ id: 'tests/unit/index.js' }), SCOPE_CATEGORIES.TEST);
    assert.equal(classifyNodeScope({ id: 'src/__tests__/app.js' }), SCOPE_CATEGORIES.TEST);
    assert.equal(classifyNodeScope({ id: 'fixtures/sample.js' }), SCOPE_CATEGORIES.TEST);

    assert.equal(classifyNodeScope({ id: 'scripts/build.js' }), SCOPE_CATEGORIES.TOOLING);
    assert.equal(classifyNodeScope({ id: 'benchmarks/ops.js' }), SCOPE_CATEGORIES.TOOLING);
    assert.equal(classifyNodeScope({ id: 'docs/guide.js' }), SCOPE_CATEGORIES.TOOLING);
    assert.equal(classifyNodeScope({ id: 'vite.config.js' }), SCOPE_CATEGORIES.TOOLING);
  });

  it('respects backend node.isTest flag regardless of path', () => {
    assert.equal(classifyNodeScope({ id: 'src/utils.js', isTest: true }), SCOPE_CATEGORIES.TEST);
  });

  it('classifies root files correctly', () => {
    assert.equal(classifyNodeScope({ id: 'index.js' }), SCOPE_CATEGORIES.SOURCE);
    assert.equal(classifyNodeScope({ id: 'app.js' }), SCOPE_CATEGORIES.SOURCE);
    assert.equal(classifyNodeScope({ id: 'test.js' }), SCOPE_CATEGORIES.TEST);
  });
});

describe('scopeModel: createDefaultScope and filterGraphByScope', () => {
  const sampleNodes = [
    { id: 'index.js', fanIn: 10, fanOut: 2 },
    { id: 'lib/utils.js', fanIn: 5, fanOut: 0 },
    { id: 'test/index.test.js', fanIn: 0, fanOut: 2 },
    { id: 'test/utils.test.js', fanIn: 0, fanOut: 1 },
    { id: 'examples/basic/index.js', fanIn: 0, fanOut: 1 },
    { id: 'scripts/release.js', fanIn: 0, fanOut: 0 }, // isolated
  ];

  const sampleEdges = [
    { source: 'test/index.test.js', target: 'index.js' },
    { source: 'test/utils.test.js', target: 'lib/utils.js' },
    { source: 'examples/basic/index.js', target: 'index.js' },
    { source: 'index.js', target: 'lib/utils.js' },
  ];

  it('creates default scope prioritizing source files', () => {
    const defaultScope = createDefaultScope(sampleNodes);
    assert.ok(defaultScope.categories.has(SCOPE_CATEGORIES.SOURCE));
    assert.ok(!defaultScope.categories.has(SCOPE_CATEGORIES.TEST));
    assert.ok(!defaultScope.categories.has(SCOPE_CATEGORIES.EXAMPLE));
    assert.equal(defaultScope.showIsolated, false);
  });

  it('filters visible subgraph to source only by default and excludes orphaned edges', () => {
    const defaultScope = createDefaultScope(sampleNodes);
    const result = filterGraphByScope(sampleNodes, sampleEdges, defaultScope);

    assert.equal(result.visibleNodes.length, 2); // index.js, lib/utils.js
    assert.deepEqual(
      result.visibleNodes.map((n) => n.id).sort(),
      ['index.js', 'lib/utils.js']
    );

    // Only edge between index.js and lib/utils.js should remain
    assert.equal(result.visibleEdges.length, 1);
    assert.equal(result.visibleEdges[0].source, 'index.js');
    assert.equal(result.visibleEdges[0].target, 'lib/utils.js');

    // Check hidden counts
    assert.equal(result.hiddenCounts.test, 2);
    assert.equal(result.hiddenCounts.example, 1);
    assert.equal(result.hiddenCounts.tooling, 1); // scripts/release.js
  });

  it('falls back to all nodes if default scope would yield 0 nodes', () => {
    const testOnlyNodes = [
      { id: 'test/a.js', isTest: true },
      { id: 'test/b.js', isTest: true },
    ];
    const defaultScope = createDefaultScope(testOnlyNodes);
    const result = filterGraphByScope(testOnlyNodes, [], defaultScope);
    assert.equal(result.visibleNodes.length, 2);
    assert.equal(result.isFallbackAll, true);
  });

  it('respects folder include and folder exclude', () => {
    const scopeWithFolder = {
      categories: new Set(Object.values(SCOPE_CATEGORIES)),
      folderInclude: 'lib',
      folderExclude: new Set(),
      extensions: new Set(),
      minFanIn: 0,
      showIsolated: true,
    };
    const result = filterGraphByScope(sampleNodes, sampleEdges, scopeWithFolder);
    assert.equal(result.visibleNodes.length, 1);
    assert.equal(result.visibleNodes[0].id, 'lib/utils.js');
  });

  it('respects minFanIn filter', () => {
    const scopeWithFanIn = {
      categories: new Set(Object.values(SCOPE_CATEGORIES)),
      folderInclude: null,
      folderExclude: new Set(),
      extensions: new Set(),
      minFanIn: 6, // only index.js has fanIn 10 >= 6
      showIsolated: true,
    };
    const result = filterGraphByScope(sampleNodes, sampleEdges, scopeWithFanIn);
    assert.equal(result.visibleNodes.length, 1);
    assert.equal(result.visibleNodes[0].id, 'index.js');
  });
});

describe('scopeModel: formatScopeBanner', () => {
  it('formats banner for partial and full views', () => {
    assert.equal(formatScopeBanner(100, 100, {}), 'Showing all 100 files');
    const banner = formatScopeBanner(142, 7, {
      test: 92,
      example: 43,
      tooling: 0,
      isolated: 0,
    });
    assert.equal(banner, 'Showing 7 of 142 files. 92 test, 43 example hidden.');
  });
});

describe('scopeModel: splitNodesByCategory', () => {
  it('splits dependents cleanly into source vs non-source', () => {
    const dependents = [
      'lib/router.js',
      'test/app.test.js',
      'test/res.test.js',
      'examples/hello.js',
    ];
    const split = splitNodesByCategory(dependents);
    assert.equal(split.total, 4);
    assert.equal(split.sourceCount, 1);
    assert.equal(split.nonSourceCount, 3);
    assert.equal(split.summaryLabel, '4 files (1 source, 3 tests/examples)');
  });
});
