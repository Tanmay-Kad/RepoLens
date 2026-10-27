import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ZOOM_THRESHOLDS,
  computeNodeSize,
  getNodeVisualCues,
  shouldShowLabelAtZoom,
  resolveLabelCollisions,
} from './labelLOD.js';

describe('labelLOD: computeNodeSize', () => {
  it('computes capped node size from fanIn', () => {
    assert.equal(computeNodeSize({ fanIn: 0 }), 32);
    assert.equal(computeNodeSize({ fanIn: 2 }), 35);
    assert.equal(computeNodeSize({ fanIn: 8 }), 44);
    assert.equal(computeNodeSize({ fanIn: 16 }), 56);
    // Over the cap of 16
    assert.equal(computeNodeSize({ fanIn: 100 }), 56);
  });
});

describe('labelLOD: getNodeVisualCues', () => {
  it('provides distinct shapes and border styles for accessibility', () => {
    assert.deepEqual(getNodeVisualCues({ inCycle: true }), {
      shape: 'round-rectangle',
      borderStyle: 'dashed',
      borderWidth: 3,
    });
    assert.deepEqual(getNodeVisualCues({ isEntryCandidate: true }), {
      shape: 'hexagon',
      borderStyle: 'solid',
      borderWidth: 3,
    });
    assert.deepEqual(getNodeVisualCues({ isTest: true }), {
      shape: 'tag',
      borderStyle: 'solid',
      borderWidth: 2,
    });
    assert.deepEqual(getNodeVisualCues({ fanIn: 3 }), {
      shape: 'diamond',
      borderStyle: 'solid',
      borderWidth: 2,
    });
    assert.deepEqual(getNodeVisualCues({ fanIn: 0 }), {
      shape: 'ellipse',
      borderStyle: 'solid',
      borderWidth: 2,
    });
  });
});

describe('labelLOD: shouldShowLabelAtZoom', () => {
  const entryNode = { id: 'index.js', isEntryCandidate: true, fanIn: 1 };
  const highFanInNode = { id: 'lib/utils.js', fanIn: 6 };
  const midFanInNode = { id: 'lib/parser.js', fanIn: 2 };
  const lowFanInNode = { id: 'lib/helper.js', fanIn: 0 };

  it('filters labels at low zoom (< 0.4)', () => {
    assert.equal(shouldShowLabelAtZoom(entryNode, 0.3), true);
    assert.equal(shouldShowLabelAtZoom(highFanInNode, 0.3), true);
    assert.equal(shouldShowLabelAtZoom(midFanInNode, 0.3), false);
    assert.equal(shouldShowLabelAtZoom(lowFanInNode, 0.3), false);
  });

  it('always shows selected node and neighbors regardless of zoom', () => {
    const selectedId = 'lib/helper.js';
    const neighbors = new Set(['lib/subhelper.js']);
    assert.equal(shouldShowLabelAtZoom({ id: 'lib/helper.js', fanIn: 0 }, 0.1, selectedId), true);
    assert.equal(shouldShowLabelAtZoom({ id: 'lib/subhelper.js', fanIn: 0 }, 0.1, null, neighbors), true);
  });
});

describe('labelLOD: resolveLabelCollisions', () => {
  it('suppresses lower-priority colliding label and keeps higher-priority label', () => {
    // Two nodes whose label boxes overlap
    const highNode = { id: 'index.js', isEntryCandidate: true, fanIn: 10 };
    const lowNode = { id: 'test/index.test.js', isTest: true, fanIn: 0 };

    const candidates = [
      {
        id: 'index.js',
        node: highNode,
        box: { x1: 10, y1: 10, x2: 60, y2: 30 },
      },
      {
        id: 'test/index.test.js',
        node: lowNode,
        box: { x1: 20, y1: 15, x2: 70, y2: 35 }, // overlapping box!
      },
      {
        id: 'other.js',
        node: { id: 'other.js', fanIn: 1 },
        box: { x1: 200, y1: 200, x2: 250, y2: 220 }, // non-overlapping
      },
    ];

    const visibleLabels = resolveLabelCollisions(candidates, 1.0);

    // High node label should be visible
    assert.ok(visibleLabels.has('index.js'));
    // Non-colliding node label should be visible
    assert.ok(visibleLabels.has('other.js'));
    // Lower priority colliding label should be hidden!
    assert.equal(visibleLabels.has('test/index.test.js'), false);
    assert.equal(visibleLabels.size, 2);
  });
});
