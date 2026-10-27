/**
 * Pure neighborhood computation for Focus Mode and neighborhood dimming.
 * Supports depth 1 or 2, directional traversal (dependents / dependencies / both),
 * loop prevention on cyclic graphs, and scope awareness.
 */

export const FOCUS_DIRECTIONS = {
  BOTH: 'both',
  DEPENDENTS: 'dependents',
  DEPENDENCIES: 'dependencies',
};

/**
 * Computes the neighborhood of a node up to depth 1 or 2.
 *
 * @param {string} rootNodeId
 * @param {{
 *   nodeMap?: Map<string, object>,
 *   incomingMap?: Map<string, string[]>,
 *   outgoingMap?: Map<string, string[]>,
 *   nodes?: Array<{ id: string }>,
 *   visibleNodeIds?: Set<string>
 * }} model
 * @param {{
 *   depth?: number,
 *   direction?: 'both' | 'dependents' | 'dependencies',
 *   respectScope?: boolean,
 *   allowedNodeIds?: Set<string>
 * }} options
 * @returns {{
 *   rootNodeId: string|null,
 *   neighborhoodNodeIds: Set<string>,
 *   dependentCount: number,
 *   dependencyCount: number,
 *   directDependents: Set<string>,
 *   directDependencies: Set<string>,
 *   depth: number,
 *   direction: string
 * }}
 */
export function computeNeighborhood(rootNodeId, model, options = {}) {
  const depth = options.depth === 2 ? 2 : 1;
  const direction = options.direction || FOCUS_DIRECTIONS.BOTH;
  const respectScope = options.respectScope ?? true;
  const allowedIds = options.allowedNodeIds || model?.visibleNodeIds || null;

  const emptyResult = {
    rootNodeId: null,
    neighborhoodNodeIds: new Set(),
    dependentCount: 0,
    dependencyCount: 0,
    directDependents: new Set(),
    directDependencies: new Set(),
    depth,
    direction,
  };

  if (!rootNodeId || !model) {
    return emptyResult;
  }

  // Verify rootNode exists in model
  const hasRoot = model.nodeMap
    ? model.nodeMap.has(rootNodeId)
    : (model.nodes || []).some((n) => n.id === rootNodeId);

  if (!hasRoot) {
    return emptyResult;
  }

  const isAllowed = (id) => {
    if (!respectScope || !allowedIds) return true;
    return allowedIds.has(id);
  };

  const visitedDependents = new Set();
  const directDependents = new Set();

  const visitedDependencies = new Set();
  const directDependencies = new Set();

  // 1. Traverse Dependents (incoming edges: files that import rootNodeId)
  if (
    direction === FOCUS_DIRECTIONS.BOTH ||
    direction === FOCUS_DIRECTIONS.DEPENDENTS
  ) {
    const queue = [{ id: rootNodeId, currentDepth: 0 }];
    const seen = new Set([rootNodeId]);

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift();
      if (currentDepth >= depth) continue;

      const incoming = model.incomingMap?.get(id) || [];
      for (const parentId of incoming) {
        if (!seen.has(parentId)) {
          seen.add(parentId);
          if (isAllowed(parentId)) {
            visitedDependents.add(parentId);
            if (currentDepth === 0) {
              directDependents.add(parentId);
            }
            queue.push({ id: parentId, currentDepth: currentDepth + 1 });
          }
        }
      }
    }
  }

  // 2. Traverse Dependencies (outgoing edges: files imported by rootNodeId)
  if (
    direction === FOCUS_DIRECTIONS.BOTH ||
    direction === FOCUS_DIRECTIONS.DEPENDENCIES
  ) {
    const queue = [{ id: rootNodeId, currentDepth: 0 }];
    const seen = new Set([rootNodeId]);

    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift();
      if (currentDepth >= depth) continue;

      const outgoing = model.outgoingMap?.get(id) || [];
      for (const childId of outgoing) {
        if (!seen.has(childId)) {
          seen.add(childId);
          if (isAllowed(childId)) {
            visitedDependencies.add(childId);
            if (currentDepth === 0) {
              directDependencies.add(childId);
            }
            queue.push({ id: childId, currentDepth: currentDepth + 1 });
          }
        }
      }
    }
  }

  const neighborhoodNodeIds = new Set([
    rootNodeId,
    ...visitedDependents,
    ...visitedDependencies,
  ]);

  return {
    rootNodeId,
    neighborhoodNodeIds,
    dependentCount: visitedDependents.size,
    dependencyCount: visitedDependencies.size,
    directDependents,
    directDependencies,
    depth,
    direction,
  };
}
