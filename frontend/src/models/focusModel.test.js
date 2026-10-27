import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeNeighborhood, FOCUS_DIRECTIONS } from './focusModel.js';

describe('focusModel: computeNeighborhood', () => {
  // Graph structure:
  // A -> B -> C -> D
  // E -> B
  // B -> F
  // Cycle: X -> Y -> X
  const mockModel = {
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }, { id: 'F' }, { id: 'X' }, { id: 'Y' }, { id: 'isolated' }],
    nodeMap: new Map([
      ['A', { id: 'A' }],
      ['B', { id: 'B' }],
      ['C', { id: 'C' }],
      ['D', { id: 'D' }],
      ['E', { id: 'E' }],
      ['F', { id: 'F' }],
      ['X', { id: 'X' }],
      ['Y', { id: 'Y' }],
      ['isolated', { id: 'isolated' }],
    ]),
    incomingMap: new Map([
      ['A', []],
      ['B', ['A', 'E']],
      ['C', ['B']],
      ['D', ['C']],
      ['E', []],
      ['F', ['B']],
      ['X', ['Y']],
      ['Y', ['X']],
      ['isolated', []],
    ]),
    outgoingMap: new Map([
      ['A', ['B']],
      ['B', ['C', 'F']],
      ['C', ['D']],
      ['D', []],
      ['E', ['B']],
      ['F', []],
      ['X', ['Y']],
      ['Y', ['X']],
      ['isolated', []],
    ]),
  };

  it('handles depth 1 for both directions around node B', () => {
    const res = computeNeighborhood('B', mockModel, { depth: 1, direction: FOCUS_DIRECTIONS.BOTH });
    assert.equal(res.rootNodeId, 'B');
    // Dependents at depth 1: A, E (2)
    assert.equal(res.dependentCount, 2);
    // Dependencies at depth 1: C, F (2)
    assert.equal(res.dependencyCount, 2);
    // Total in neighborhood: B, A, E, C, F (5)
    assert.equal(res.neighborhoodNodeIds.size, 5);
    assert.ok(res.neighborhoodNodeIds.has('A'));
    assert.ok(res.neighborhoodNodeIds.has('B'));
    assert.ok(res.neighborhoodNodeIds.has('C'));
    assert.ok(res.neighborhoodNodeIds.has('E'));
    assert.ok(res.neighborhoodNodeIds.has('F'));
    assert.ok(!res.neighborhoodNodeIds.has('D')); // D is depth 2
  });

  it('handles depth 2 expanding to transitive dependencies and dependents', () => {
    const res = computeNeighborhood('B', mockModel, { depth: 2, direction: FOCUS_DIRECTIONS.BOTH });
    // D is reached at depth 2 from C
    assert.ok(res.neighborhoodNodeIds.has('D'));
    assert.equal(res.dependencyCount, 3); // C, F, D
    assert.equal(res.dependentCount, 2); // A, E (A and E have no incoming)
  });

  it('restricts traversal to direction: dependencies only', () => {
    const res = computeNeighborhood('B', mockModel, { depth: 1, direction: FOCUS_DIRECTIONS.DEPENDENCIES });
    assert.equal(res.dependentCount, 0);
    assert.equal(res.dependencyCount, 2);
    assert.deepEqual(Array.from(res.neighborhoodNodeIds).sort(), ['B', 'C', 'F']);
  });

  it('restricts traversal to direction: dependents only', () => {
    const res = computeNeighborhood('B', mockModel, { depth: 1, direction: FOCUS_DIRECTIONS.DEPENDENTS });
    assert.equal(res.dependencyCount, 0);
    assert.equal(res.dependentCount, 2);
    assert.deepEqual(Array.from(res.neighborhoodNodeIds).sort(), ['A', 'B', 'E']);
  });

  it('terminates cleanly on circular dependency loops without infinite loop', () => {
    const res = computeNeighborhood('X', mockModel, { depth: 2, direction: FOCUS_DIRECTIONS.BOTH });
    assert.equal(res.rootNodeId, 'X');
    assert.ok(res.neighborhoodNodeIds.has('X'));
    assert.ok(res.neighborhoodNodeIds.has('Y'));
    assert.equal(res.neighborhoodNodeIds.size, 2);
  });

  it('handles isolated node with no edges', () => {
    const res = computeNeighborhood('isolated', mockModel, { depth: 2, direction: FOCUS_DIRECTIONS.BOTH });
    assert.equal(res.rootNodeId, 'isolated');
    assert.equal(res.dependentCount, 0);
    assert.equal(res.dependencyCount, 0);
    assert.deepEqual(Array.from(res.neighborhoodNodeIds), ['isolated']);
  });

  it('returns empty result when node is not found in model', () => {
    const res = computeNeighborhood('nonexistent', mockModel);
    assert.equal(res.rootNodeId, null);
    assert.equal(res.neighborhoodNodeIds.size, 0);
    assert.equal(res.dependentCount, 0);
  });

  it('respects allowedNodeIds / scope filter', () => {
    // Only allow A, B, C (disallow E and F)
    const res = computeNeighborhood('B', mockModel, {
      depth: 1,
      direction: FOCUS_DIRECTIONS.BOTH,
      respectScope: true,
      allowedNodeIds: new Set(['A', 'B', 'C']),
    });
    assert.equal(res.dependentCount, 1); // only A
    assert.equal(res.dependencyCount, 1); // only C
    assert.deepEqual(Array.from(res.neighborhoodNodeIds).sort(), ['A', 'B', 'C']);
  });
});
