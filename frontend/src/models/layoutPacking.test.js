import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  doBoxesOverlap,
  packComponentsInGrid,
  layoutIsolatedGrid,
} from './layoutPacking.js';

describe('layoutPacking: doBoxesOverlap', () => {
  it('detects intersecting boxes', () => {
    const box1 = { x1: 0, y1: 0, x2: 100, y2: 100 };
    const box2 = { x1: 50, y1: 50, x2: 150, y2: 150 };
    assert.equal(doBoxesOverlap(box1, box2), true);
  });

  it('detects disjoint boxes correctly', () => {
    const box1 = { x1: 0, y1: 0, x2: 40, y2: 40 };
    const box2 = { x1: 50, y1: 50, x2: 100, y2: 100 };
    assert.equal(doBoxesOverlap(box1, box2), false);
  });

  it('respects padding threshold', () => {
    const box1 = { x1: 0, y1: 0, x2: 40, y2: 40 };
    const box2 = { x1: 45, y1: 0, x2: 90, y2: 40 };
    // No overlap with padding 0
    assert.equal(doBoxesOverlap(box1, box2, 0), false);
    // Overlaps when padding is 10 (40 + 10 > 45)
    assert.equal(doBoxesOverlap(box1, box2, 10), true);
  });
});

describe('layoutPacking: packComponentsInGrid', () => {
  it('returns empty array when input is empty', () => {
    assert.deepEqual(packComponentsInGrid([]), []);
  });

  it('packs multiple components with zero overlap between any pair', () => {
    const components = [
      { id: 'c1', w: 120, h: 80 },
      { id: 'c2', w: 140, h: 90 },
      { id: 'c3', w: 100, h: 110 },
      { id: 'c4', w: 150, h: 70 },
      { id: 'c5', w: 80, h: 80 },
    ];

    const packed = packComponentsInGrid(components, { padding: 30, maxColumns: 2 });
    assert.equal(packed.length, 5);

    // Verify all pairs do not overlap
    for (let i = 0; i < packed.length; i++) {
      for (let j = i + 1; j < packed.length; j++) {
        const overlap = doBoxesOverlap(packed[i], packed[j], 0);
        assert.equal(
          overlap,
          false,
          `Component ${packed[i].id} and ${packed[j].id} must not overlap`
        );
      }
    }
  });
});

describe('layoutPacking: layoutIsolatedGrid', () => {
  it('arranges isolated nodes in deterministic grid coordinates', () => {
    const isolated = ['iso-1', 'iso-2', 'iso-3', 'iso-4', 'iso-5'];
    const grid = layoutIsolatedGrid(isolated, { columns: 3, spacingX: 80, spacingY: 80 });

    assert.equal(grid.size, 5);

    // Row 0
    assert.deepEqual(grid.get('iso-1'), { x: 0, y: 0 });
    assert.deepEqual(grid.get('iso-2'), { x: 80, y: 0 });
    assert.deepEqual(grid.get('iso-3'), { x: 160, y: 0 });

    // Row 1
    assert.deepEqual(grid.get('iso-4'), { x: 0, y: 80 });
    assert.deepEqual(grid.get('iso-5'), { x: 80, y: 80 });
  });
});
