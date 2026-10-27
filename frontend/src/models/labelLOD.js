/**
 * Label Level-of-Detail (LOD), node sizing, and collision avoidance model.
 * Pure logic for determining label visibility based on zoom level,
 * semantic node priority, and bounding-box collision avoidance.
 */

export const ZOOM_THRESHOLDS = {
  LOW: 0.4, // Far out zoom (< 0.4): entry points, high fan-in (>= 4), selected & neighbors only
  MEDIUM: 0.75, // Medium zoom (0.4 - 0.75): fan-in >= 2, cycles, entries, selected & neighbors
  HIGH: 1.1, // Zoom >= 0.75: all labels shown subject to collision avoidance
};

export const NODE_SIZING = {
  MIN_SIZE: 32,
  MAX_SIZE: 56,
  FAN_IN_MULTIPLIER: 1.5,
  MAX_FAN_IN_CAP: 16,
};

/**
 * Computes node diameter based on a capped linear function of fan-in.
 * Sizing formula: min(MAX_SIZE, MIN_SIZE + min(fanIn, MAX_FAN_IN_CAP) * FAN_IN_MULTIPLIER)
 *
 * @param {{ fanIn?: number }} node
 * @returns {number} diameter in pixels
 */
export function computeNodeSize(node) {
  const fanIn = typeof node?.fanIn === 'number' ? node.fanIn : 0;
  const clampedFanIn = Math.min(Math.max(0, fanIn), NODE_SIZING.MAX_FAN_IN_CAP);
  return Math.round(
    Math.min(
      NODE_SIZING.MAX_SIZE,
      NODE_SIZING.MIN_SIZE + clampedFanIn * NODE_SIZING.FAN_IN_MULTIPLIER
    )
  );
}

/**
 * Returns distinct geometric shape and border style for accessibility (non-color cues).
 *
 * @param {{
 *   isEntryCandidate?: boolean,
 *   nodeKind?: string,
 *   isTest?: boolean,
 *   fanIn?: number,
 *   inCycle?: boolean
 * }} node
 * @returns {{ shape: string, borderStyle: string, borderWidth: number }}
 */
export function getNodeVisualCues(node) {
  if (node?.inCycle) {
    return { shape: 'round-rectangle', borderStyle: 'dashed', borderWidth: 3 };
  }
  if (node?.isEntryCandidate) {
    return { shape: 'hexagon', borderStyle: 'solid', borderWidth: 3 };
  }
  if (node?.isTest) {
    return { shape: 'tag', borderStyle: 'solid', borderWidth: 2 };
  }
  if ((node?.fanIn || 0) >= 2) {
    return { shape: 'diamond', borderStyle: 'solid', borderWidth: 2 };
  }
  return { shape: 'ellipse', borderStyle: 'solid', borderWidth: 2 };
}

/**
 * Computes semantic priority for label visibility during collision resolution.
 * Higher number means higher priority to keep label visible.
 *
 * @param {object} node
 * @param {string|null} selectedId
 * @param {Set<string>} neighborIds
 * @returns {number}
 */
export function computeNodePriority(node, selectedId = null, neighborIds = null) {
  if (!node) return 0;
  if (node.id === selectedId) return 1000;
  if (neighborIds && neighborIds.has(node.id)) return 900;
  if (node.inCycle) return 800;
  if (node.isEntryCandidate) return 700;

  const fanIn = typeof node.fanIn === 'number' ? node.fanIn : 0;
  if (fanIn >= 5) return 600 + fanIn;
  if (fanIn >= 2) return 400 + fanIn;
  if (node.isTest) return 100;
  return 200 + fanIn;
}

/**
 * Determines whether a label qualifies for display based on zoom level
 * before collision avoidance.
 *
 * @param {object} node
 * @param {number} zoom
 * @param {string|null} selectedId
 * @param {Set<string>} neighborIds
 * @returns {boolean}
 */
export function shouldShowLabelAtZoom(node, zoom, selectedId = null, neighborIds = null) {
  if (!node) return false;
  if (node.id === selectedId) return true;
  if (neighborIds && neighborIds.has(node.id)) return true;

  const fanIn = typeof node.fanIn === 'number' ? node.fanIn : 0;

  if (zoom < ZOOM_THRESHOLDS.LOW) {
    return Boolean(node.isEntryCandidate || fanIn >= 5 || node.inCycle);
  }

  if (zoom < ZOOM_THRESHOLDS.MEDIUM) {
    return Boolean(node.isEntryCandidate || fanIn >= 2 || node.inCycle);
  }

  return true;
}

/**
 * Resolves label collisions among visible nodes by hiding lower-priority labels
 * when bounding boxes intersect.
 *
 * @param {Array<{
 *   id: string,
 *   node: object,
 *   box: { x1: number, y1: number, x2: number, y2: number },
 *   priority?: number
 * }>} labelCandidates
 * @param {number} zoom
 * @param {string|null} selectedId
 * @param {Set<string>} neighborIds
 * @returns {Set<string>} Set of node IDs whose labels should be rendered
 */
export function resolveLabelCollisions(
  labelCandidates = [],
  zoom = 1,
  selectedId = null,
  neighborIds = null
) {
  const visibleLabelIds = new Set();
  const placedBoxes = [];

  // Filter candidates by zoom qualification and attach priority
  const qualified = [];
  for (const item of labelCandidates) {
    if (shouldShowLabelAtZoom(item.node, zoom, selectedId, neighborIds)) {
      const priority =
        item.priority ?? computeNodePriority(item.node, selectedId, neighborIds);
      qualified.push({ ...item, priority });
    }
  }

  // Sort descending by priority so most important nodes claim screen space first
  qualified.sort((a, b) => b.priority - a.priority);

  for (const item of qualified) {
    const box = item.box;
    let collides = false;

    // Check collision against already-placed higher priority labels
    for (const placed of placedBoxes) {
      const xOverlap = Math.max(
        0,
        Math.min(box.x2, placed.x2) - Math.max(box.x1, placed.x1)
      );
      const yOverlap = Math.max(
        0,
        Math.min(box.y2, placed.y2) - Math.max(box.y1, placed.y1)
      );
      if (xOverlap > 0 && yOverlap > 0) {
        collides = true;
        break;
      }
    }

    if (!collides) {
      placedBoxes.push(box);
      visibleLabelIds.add(item.id);
    }
  }

  return visibleLabelIds;
}
