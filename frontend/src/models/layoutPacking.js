/**
 * Pure packing helpers for graph components and isolated node grids.
 * Used when multiple disconnected components need collision-free packing
 * and for drawing isolated files in a tidy grid.
 */

export const GRAPH_LAYOUTS = {
  FORCE: 'cose',
  LAYERED: 'breadthfirst',
  CONCENTRIC: 'concentric',
};

/**
 * Checks if two axis-aligned bounding boxes overlap.
 * @param {{ x1: number, y1: number, x2: number, y2: number }} a
 * @param {{ x1: number, y1: number, x2: number, y2: number }} b
 * @param {number} padding
 * @returns {boolean}
 */
export function doBoxesOverlap(a, b, padding = 0) {
  return !(
    a.x2 + padding <= b.x1 ||
    b.x2 + padding <= a.x1 ||
    a.y2 + padding <= b.y1 ||
    b.y2 + padding <= a.y1
  );
}

/**
 * Packs multiple component bounding boxes into a tidy grid arrangement
 * without overlapping.
 *
 * @param {Array<{ id: string|number, w: number, h: number, x1?: number, y1?: number, x2?: number, y2?: number }>} components
 * @param {{ padding?: number, maxColumns?: number }} options
 * @returns {Array<{ id: string|number, x: number, y: number, w: number, h: number }>}
 */
export function packComponentsInGrid(components = [], options = {}) {
  if (!components || components.length === 0) return [];

  const padding = options.padding ?? 50;
  const maxColumns = options.maxColumns || Math.max(1, Math.ceil(Math.sqrt(components.length)));

  const result = [];
  let currentX = 0;
  let currentY = 0;
  let rowMaxHeight = 0;
  let colIndex = 0;

  for (let i = 0; i < components.length; i++) {
    const comp = components[i];
    const w = comp.w || (comp.x2 != null && comp.x1 != null ? comp.x2 - comp.x1 : 100);
    const h = comp.h || (comp.y2 != null && comp.y1 != null ? comp.y2 - comp.y1 : 100);

    result.push({
      id: comp.id,
      x: currentX,
      y: currentY,
      w,
      h,
      x1: currentX,
      y1: currentY,
      x2: currentX + w,
      y2: currentY + h,
    });

    currentX += w + padding;
    rowMaxHeight = Math.max(rowMaxHeight, h);
    colIndex++;

    if (colIndex >= maxColumns && i < components.length - 1) {
      colIndex = 0;
      currentX = 0;
      currentY += rowMaxHeight + padding;
      rowMaxHeight = 0;
    }
  }

  return result;
}

/**
 * Computes deterministic grid positions for isolated nodes.
 *
 * @param {Array<string|{ id: string }>} isolatedNodes
 * @param {{
 *   startX?: number,
 *   startY?: number,
 *   columns?: number,
 *   spacingX?: number,
 *   spacingY?: number
 * }} options
 * @returns {Map<string, { x: number, y: number }>}
 */
export function layoutIsolatedGrid(isolatedNodes = [], options = {}) {
  const startX = options.startX ?? 0;
  const startY = options.startY ?? 0;
  const columns = options.columns || Math.max(1, Math.min(8, Math.ceil(Math.sqrt(isolatedNodes.length || 1))));
  const spacingX = options.spacingX ?? 75;
  const spacingY = options.spacingY ?? 75;

  const positions = new Map();

  isolatedNodes.forEach((item, index) => {
    const id = typeof item === 'string' ? item : item?.id;
    if (!id) return;

    const row = Math.floor(index / columns);
    const col = index % columns;

    positions.set(id, {
      x: startX + col * spacingX,
      y: startY + row * spacingY,
    });
  });

  return positions;
}
