/**
 * Scope classification and subgraph filtering model.
 * Framework-free pure logic for categorizing files into source, test, example, and tooling,
 * and computing visible subgraphs based on active scope filters.
 */

export const SCOPE_CATEGORIES = {
  SOURCE: 'source',
  TEST: 'test',
  EXAMPLE: 'example',
  TOOLING: 'tooling',
};

// Documented whole-path segment heuristics (strictly whole-segment comparison)
const TEST_SEGMENTS = new Set([
  'test',
  'tests',
  '__tests__',
  'spec',
  'specs',
  'fixtures',
  '__fixtures__',
  'mocks',
  '__mocks__',
]);

const EXAMPLE_SEGMENTS = new Set([
  'example',
  'examples',
  'demo',
  'demos',
  'sample',
  'samples',
]);

const TOOLING_SEGMENTS = new Set([
  'tool',
  'tools',
  'tooling',
  'script',
  'scripts',
  'benchmark',
  'benchmarks',
  'docs',
  'doc',
  'build',
  'tasks',
  '.github',
]);

const ROOT_CONFIG_FILENAMES = new Set([
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js',
  'rollup.config.js',
  'jest.config.js',
  'jest.config.ts',
  'babel.config.js',
  'eslint.config.js',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'tailwind.config.js',
  'tailwind.config.ts',
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'tsconfig.json',
]);

/**
 * Classifies a node into one of four scope categories:
 * - 'test'
 * - 'example'
 * - 'tooling'
 * - 'source'
 *
 * Checks backend node.isTest flag first, then strictly evaluates whole path segments.
 * Substring matches are NEVER used (e.g. `src/exampleParser.js` is source).
 *
 * @param {{ id: string, isTest?: boolean }} node
 * @returns {'source' | 'test' | 'example' | 'tooling'}
 */
export function classifyNodeScope(node) {
  if (!node || !node.id) return SCOPE_CATEGORIES.SOURCE;

  // 1. Backend flag takes precedence if true
  if (node.isTest === true) {
    return SCOPE_CATEGORIES.TEST;
  }

  // 2. Normalize path and split into segments
  const normalized = node.id.replace(/\\/g, '/').replace(/^\.\//, '');
  const segments = normalized.split('/').filter(Boolean);

  if (segments.length === 0) return SCOPE_CATEGORIES.SOURCE;

  const fileName = segments[segments.length - 1].toLowerCase();
  const dirSegments = segments.slice(0, segments.length - 1).map((s) => s.toLowerCase());

  // Check test file naming patterns (e.g., app.test.js, index.spec.ts, test.js)
  const baseWithoutExt = fileName.replace(/\.[^.]+$/, '');
  if (
    TEST_SEGMENTS.has(baseWithoutExt) ||
    /\.(test|spec)\.[a-z0-9]+$/i.test(fileName) ||
    fileName.startsWith('test-') ||
    fileName.endsWith('-test.js')
  ) {
    return SCOPE_CATEGORIES.TEST;
  }

  // Check whole path segments for directories
  for (const seg of dirSegments) {
    if (TEST_SEGMENTS.has(seg)) {
      return SCOPE_CATEGORIES.TEST;
    }
    if (EXAMPLE_SEGMENTS.has(seg)) {
      return SCOPE_CATEGORIES.EXAMPLE;
    }
    if (TOOLING_SEGMENTS.has(seg)) {
      return SCOPE_CATEGORIES.TOOLING;
    }
  }

  // Check root config files
  if (segments.length === 1 && ROOT_CONFIG_FILENAMES.has(fileName)) {
    return SCOPE_CATEGORIES.TOOLING;
  }

  return SCOPE_CATEGORIES.SOURCE;
}

/**
 * Creates the default viewScope configuration.
 * Default scope: source files only when any `source` node exists, otherwise all categories.
 * If default would show 0 nodes, falls back to everything.
 *
 * @param {Array<{ id: string, isTest?: boolean }>} nodes
 * @returns {object}
 */
export function createDefaultScope(nodes = []) {
  let sourceCount = 0;
  for (const n of nodes) {
    if (classifyNodeScope(n) === SCOPE_CATEGORIES.SOURCE) {
      sourceCount++;
    }
  }

  const categories =
    sourceCount > 0
      ? new Set([SCOPE_CATEGORIES.SOURCE])
      : new Set(Object.values(SCOPE_CATEGORIES));

  return {
    categories,
    folderInclude: null, // string | null (focus folder)
    folderExclude: new Set(), // Set<string>
    extensions: new Set(), // Set<string>
    minFanIn: 0,
    showIsolated: false, // Isolated files hidden from canvas by default
  };
}

/**
 * Extracts file extension from a node path (e.g. '.js', '.tsx').
 * @param {string} id
 * @returns {string}
 */
export function getNodeExtension(id) {
  if (!id) return '';
  const match = id.match(/\.[0-9a-z]+$/i);
  return match ? match[0].toLowerCase() : '';
}

/**
 * Pure function returning the visible subgraph based on current viewScope.
 *
 * @param {Array<object>} nodes
 * @param {Array<object>} edges
 * @param {object} scope
 * @returns {{
 *   visibleNodes: Array<object>,
 *   visibleEdges: Array<object>,
 *   visibleNodeIds: Set<string>,
 *   hiddenCounts: {
 *     total: number,
 *     test: number,
 *     example: number,
 *     tooling: number,
 *     source: number,
 *     folder: number,
 *     extension: number,
 *     minFanIn: number,
 *     isolated: number
 *   },
 *   categoryCounts: { source: number, test: number, example: number, tooling: number },
 *   extensionCounts: Record<string, number>
 * }}
 */
export function filterGraphByScope(nodes = [], edges = [], scope) {
  const activeScope = scope || createDefaultScope(nodes);

  const categoryCounts = {
    [SCOPE_CATEGORIES.SOURCE]: 0,
    [SCOPE_CATEGORIES.TEST]: 0,
    [SCOPE_CATEGORIES.EXAMPLE]: 0,
    [SCOPE_CATEGORIES.TOOLING]: 0,
  };

  const extensionCounts = {};
  const visibleNodes = [];
  const visibleNodeIds = new Set();

  const hiddenCounts = {
    total: 0,
    test: 0,
    example: 0,
    tooling: 0,
    source: 0,
    folder: 0,
    extension: 0,
    minFanIn: 0,
    isolated: 0,
  };

  for (const node of nodes) {
    const category = classifyNodeScope(node);
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

    const ext = getNodeExtension(node.id);
    if (ext) {
      extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;
    }

    // 1. Category filter
    if (activeScope.categories && !activeScope.categories.has(category)) {
      hiddenCounts.total++;
      hiddenCounts[category] = (hiddenCounts[category] || 0) + 1;
      continue;
    }

    // 2. Folder include (focus folder)
    if (activeScope.folderInclude) {
      const normalizedPath = node.id.replace(/\\/g, '/');
      const prefix = activeScope.folderInclude.endsWith('/')
        ? activeScope.folderInclude
        : `${activeScope.folderInclude}/`;
      if (!normalizedPath.startsWith(prefix) && normalizedPath !== activeScope.folderInclude) {
        hiddenCounts.total++;
        hiddenCounts.folder++;
        continue;
      }
    }

    // 3. Folder exclude
    if (activeScope.folderExclude && activeScope.folderExclude.size > 0) {
      const normalizedPath = node.id.replace(/\\/g, '/');
      let isExcluded = false;
      for (const excluded of activeScope.folderExclude) {
        const prefix = excluded.endsWith('/') ? excluded : `${excluded}/`;
        if (normalizedPath.startsWith(prefix) || normalizedPath === excluded) {
          isExcluded = true;
          break;
        }
      }
      if (isExcluded) {
        hiddenCounts.total++;
        hiddenCounts.folder++;
        continue;
      }
    }

    // 4. Extension filter
    if (activeScope.extensions && activeScope.extensions.size > 0) {
      if (!activeScope.extensions.has(ext)) {
        hiddenCounts.total++;
        hiddenCounts.extension++;
        continue;
      }
    }

    // 5. Min fan-in filter
    const fanIn = typeof node.fanIn === 'number' ? node.fanIn : 0;
    if (activeScope.minFanIn > 0 && fanIn < activeScope.minFanIn) {
      hiddenCounts.total++;
      hiddenCounts.minFanIn++;
      continue;
    }

    // 6. Isolated files toggle (canvas hides them if !showIsolated)
    const isIsolated = node.isOrphan === true || (fanIn === 0 && (node.fanOut === 0 || !node.fanOut));
    if (isIsolated && !activeScope.showIsolated) {
      hiddenCounts.total++;
      hiddenCounts.isolated++;
      continue;
    }

    visibleNodes.push(node);
    visibleNodeIds.add(node.id);
  }

  // Fallback: If scope would hide all nodes, return everything so graph is never empty
  if (visibleNodes.length === 0 && nodes.length > 0) {
    return {
      visibleNodes: [...nodes],
      visibleEdges: [...edges],
      visibleNodeIds: new Set(nodes.map((n) => n.id)),
      hiddenCounts: {
        total: 0,
        test: 0,
        example: 0,
        tooling: 0,
        source: 0,
        folder: 0,
        extension: 0,
        minFanIn: 0,
        isolated: 0,
      },
      categoryCounts,
      extensionCounts,
      isFallbackAll: true,
    };
  }

  // Filter edges where BOTH endpoints are visible
  const visibleEdges = edges.filter((edge) => {
    const src = edge.source || edge.from;
    const tgt = edge.target || edge.to;
    return visibleNodeIds.has(src) && visibleNodeIds.has(tgt);
  });

  return {
    visibleNodes,
    visibleEdges,
    visibleNodeIds,
    hiddenCounts,
    categoryCounts,
    extensionCounts,
    isFallbackAll: false,
  };
}

/**
 * Formats user-facing banner description of scope state.
 * Example: "Showing 7 of 142 files. 92 test, 43 example hidden."
 *
 * @param {number} totalCount
 * @param {number} visibleCount
 * @param {object} hiddenCounts
 * @returns {string}
 */
export function formatScopeBanner(totalCount, visibleCount, hiddenCounts) {
  if (visibleCount === totalCount) {
    return `Showing all ${totalCount} files`;
  }

  const parts = [];
  if (hiddenCounts.test > 0) parts.push(`${hiddenCounts.test} test`);
  if (hiddenCounts.example > 0) parts.push(`${hiddenCounts.example} example`);
  if (hiddenCounts.tooling > 0) parts.push(`${hiddenCounts.tooling} tooling`);
  if (hiddenCounts.isolated > 0) parts.push(`${hiddenCounts.isolated} isolated`);
  if (hiddenCounts.folder > 0) parts.push(`${hiddenCounts.folder} in hidden folders`);
  if (hiddenCounts.extension > 0) parts.push(`${hiddenCounts.extension} other ext`);

  const hiddenSummary = parts.length > 0 ? parts.join(', ') + ' hidden' : `${totalCount - visibleCount} hidden`;
  return `Showing ${visibleCount} of ${totalCount} files. ${hiddenSummary}.`;
}

/**
 * Splits a list of dependent / blast radius node IDs into source vs tests/examples/tooling.
 * Used for honest reporting in details panel.
 *
 * @param {Array<string|object>} nodeIdsOrObjects
 * @param {Map<string, object>} nodeMap
 * @returns {{
 *   total: number,
 *   sourceCount: number,
 *   nonSourceCount: number,
 *   sourceList: Array<object>,
 *   nonSourceList: Array<object>,
 *   summaryLabel: string
 * }}
 */
export function splitNodesByCategory(nodeIdsOrObjects, nodeMap) {
  const list = (nodeIdsOrObjects || []).map((item) => {
    if (typeof item === 'string') {
      return nodeMap?.get(item) || { id: item };
    }
    return item;
  });

  const sourceList = [];
  const nonSourceList = [];

  for (const node of list) {
    const cat = classifyNodeScope(node);
    if (cat === SCOPE_CATEGORIES.SOURCE) {
      sourceList.push(node);
    } else {
      nonSourceList.push(node);
    }
  }

  const summaryLabel = `${list.length} files (${sourceList.length} source, ${nonSourceList.length} tests/examples)`;

  return {
    total: list.length,
    sourceCount: sourceList.length,
    nonSourceCount: nonSourceList.length,
    sourceList,
    nonSourceList,
    summaryLabel,
  };
}
