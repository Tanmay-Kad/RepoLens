/**
 * Pure data model and index builder for graph response.
 * Importable in Node test runner (no DOM/React globals).
 */

export const NODE_KINDS = {
  CYCLE: 'cycle',
  ENTRY: 'entry',
  TEST: 'test',
  ISOLATED: 'isolated',
  IMPORTANT: 'important',
  NORMAL: 'normal',
};

export const KIND_DEFINITIONS = {
  [NODE_KINDS.CYCLE]: {
    label: 'In Circular Chain',
    description: 'File is part of a circular dependency cycle. Cyclic imports can cause runtime initialization bugs.',
    colorVar: 'var(--node-cycle)',
    colorHex: '#f43f5e',
  },
  [NODE_KINDS.ENTRY]: {
    label: 'Entry Point',
    description: 'Candidate top-level entry point (e.g. main/index/app or CLI root) with no internal dependents.',
    colorVar: 'var(--node-entry)',
    colorHex: '#f59e0b',
  },
  [NODE_KINDS.TEST]: {
    label: 'Test File',
    description: 'Test file or test fixture detected by repository heuristics (*.test, *.spec, __tests__).',
    colorVar: 'var(--node-test)',
    colorHex: '#10b981',
  },
  [NODE_KINDS.IMPORTANT]: {
    label: 'Important Module',
    description: 'Core architectural module heavily depended on across the project (fan-in >= 2).',
    colorVar: 'var(--node-important)',
    colorHex: '#8b5cf6',
  },
  [NODE_KINDS.ISOLATED]: {
    label: 'Isolated File',
    description: 'No imports in or out in the JavaScript/TypeScript dependency graph. May be used dynamically or via other entry points.',
    colorVar: 'var(--node-isolated)',
    colorHex: '#475569',
  },
  [NODE_KINDS.NORMAL]: {
    label: 'Normal Module',
    description: 'Standard source file within the dependency graph.',
    colorVar: 'var(--node-normal)',
    colorHex: '#64748b',
  },
};

/**
 * Classify a node into a semantic kind derived ONLY from real backend flags/fields.
 *
 * Precedence:
 * 1. Cycle (cycleCount > 0) -> CYCLE
 * 2. Entry candidate (node.isEntryCandidate === true) -> ENTRY
 * 3. Test module (node.isTest === true) -> TEST
 * 4. Isolated / Orphan (node.isOrphan === true OR (fanIn === 0 && fanOut === 0)) -> ISOLATED
 * 5. Important Module (fanIn >= 2) -> IMPORTANT
 * 6. Normal -> NORMAL
 */
export function classifyNodeKind(node, fanIn = 0, fanOut = 0, cycleCount = 0) {
  if (cycleCount > 0) {
    return NODE_KINDS.CYCLE;
  }
  if (node.isEntryCandidate === true) {
    return NODE_KINDS.ENTRY;
  }
  if (node.isTest === true) {
    return NODE_KINDS.TEST;
  }
  if (node.isOrphan === true || (fanIn === 0 && fanOut === 0)) {
    return NODE_KINDS.ISOLATED;
  }
  if (fanIn >= 2) {
    return NODE_KINDS.IMPORTANT;
  }
  return NODE_KINDS.NORMAL;
}

/**
 * Builds fast indexes from graph API payload.
 *
 * @param {Object} graphData - { nodes, edges, circular, metrics, analysis }
 * @returns {Object} Indexed model
 */
export function buildGraphModel(graphData = {}) {
  const rawNodes = Array.isArray(graphData.nodes) ? graphData.nodes : [];
  const rawEdges = Array.isArray(graphData.edges) ? graphData.edges : [];
  const rawCircular = Array.isArray(graphData.circular) ? graphData.circular : [];

  const nodeMap = new Map();
  const dependencies = new Map(); // outgoing: id -> array of target IDs
  const dependents = new Map();   // incoming: id -> array of source IDs
  const cycleMembership = new Map(); // id -> array of cycles

  // Initialize maps
  for (const node of rawNodes) {
    nodeMap.set(node.id, { ...node });
    dependencies.set(node.id, []);
    dependents.set(node.id, []);
    cycleMembership.set(node.id, []);
  }

  // Populate edges
  for (const edge of rawEdges) {
    const source = edge.source || edge.from;
    const target = edge.target || edge.to;

    if (source && target) {
      if (!dependencies.has(source)) dependencies.set(source, []);
      dependencies.get(source).push(target);

      if (!dependents.has(target)) dependents.set(target, []);
      dependents.get(target).push(source);
    }
  }

  // Populate cycle membership
  for (const cycle of rawCircular) {
    if (Array.isArray(cycle)) {
      const uniqueNodesInCycle = new Set(cycle);
      for (const id of uniqueNodesInCycle) {
        if (!cycleMembership.has(id)) {
          cycleMembership.set(id, []);
        }
        cycleMembership.get(id).push(cycle);
      }
    }
  }

  // Enhance nodes with computed fields
  const indexedNodes = [];
  for (const [id, node] of nodeMap.entries()) {
    const outgoing = dependencies.get(id) || [];
    const incoming = dependents.get(id) || [];
    const cycles = cycleMembership.get(id) || [];

    const fanIn = incoming.length;
    const fanOut = outgoing.length;
    const kind = classifyNodeKind(node, fanIn, fanOut, cycles.length);

    const enhancedNode = {
      ...node,
      fanIn,
      fanOut,
      dependenciesCount: fanOut,
      dependentsCount: fanIn,
      cycleCount: cycles.length,
      cycles,
      nodeKind: kind,
      kindDefinition: KIND_DEFINITIONS[kind],
    };

    nodeMap.set(id, enhancedNode);
    indexedNodes.push(enhancedNode);
  }

  return {
    rawNodes,
    rawEdges,
    rawCircular,
    nodes: indexedNodes,
    nodeMap,
    dependencies,
    dependents,
    cycleMembership,
    metrics: graphData.metrics || {},
    analysis: graphData.analysis || {},
    repo: graphData.repo || null,
    metricDefinitions: graphData.metricDefinitions || {},
  };
}
