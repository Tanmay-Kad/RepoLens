import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGraphModel,
  classifyNodeKind,
  NODE_KINDS,
  KIND_DEFINITIONS,
} from './graphModel.js';

describe('graphModel', () => {
  it('correctly builds incoming and outgoing dependency maps and indexes', () => {
    const rawData = {
      nodes: [
        { id: 'src/index.js', isEntryCandidate: true },
        { id: 'src/app.js' },
        { id: 'src/utils.js' },
      ],
      edges: [
        { source: 'src/index.js', target: 'src/app.js' },
        { source: 'src/app.js', target: 'src/utils.js' },
        { source: 'src/index.js', target: 'src/utils.js' },
      ],
      circular: [],
    };

    const model = buildGraphModel(rawData);

    assert.equal(model.nodes.length, 3);
    assert.deepEqual(model.dependencies.get('src/index.js'), ['src/app.js', 'src/utils.js']);
    assert.deepEqual(model.dependencies.get('src/app.js'), ['src/utils.js']);
    assert.deepEqual(model.dependents.get('src/utils.js'), ['src/app.js', 'src/index.js']);

    const utilsNode = model.nodeMap.get('src/utils.js');
    assert.equal(utilsNode.fanIn, 2);
    assert.equal(utilsNode.fanOut, 0);
    assert.equal(utilsNode.nodeKind, NODE_KINDS.IMPORTANT);
  });

  it('correctly maps cycle membership', () => {
    const cycle1 = ['a.js', 'b.js', 'a.js'];
    const rawData = {
      nodes: [{ id: 'a.js' }, { id: 'b.js' }, { id: 'c.js' }],
      edges: [
        { source: 'a.js', target: 'b.js' },
        { source: 'b.js', target: 'a.js' },
      ],
      circular: [cycle1],
    };

    const model = buildGraphModel(rawData);

    assert.equal(model.cycleMembership.get('a.js').length, 1);
    assert.equal(model.cycleMembership.get('b.js').length, 1);
    assert.equal(model.cycleMembership.get('c.js').length, 0);

    assert.equal(model.nodeMap.get('a.js').nodeKind, NODE_KINDS.CYCLE);
    assert.equal(model.nodeMap.get('b.js').nodeKind, NODE_KINDS.CYCLE);
  });

  describe('kind classification precedence', () => {
    it('prioritizes cycle over entry candidate', () => {
      const node = { id: 'main.js', isEntryCandidate: true };
      const kind = classifyNodeKind(node, 0, 1, 1);
      assert.equal(kind, NODE_KINDS.CYCLE);
    });

    it('prioritizes entry candidate over orphan or normal', () => {
      // Entry point with no incoming edges and 0 or more outgoing edges
      const entryNode = { id: 'index.js', isEntryCandidate: true, isOrphan: false };
      const kind = classifyNodeKind(entryNode, 0, 3, 0);
      assert.equal(kind, NODE_KINDS.ENTRY);
    });

    it('correctly classifies orphan vs entry: entry takes precedence if isEntryCandidate', () => {
      const candidate = { id: 'cli.js', isEntryCandidate: true, isOrphan: true };
      assert.equal(classifyNodeKind(candidate, 0, 0, 0), NODE_KINDS.ENTRY);

      const pureOrphan = { id: 'unused.js', isEntryCandidate: false, isOrphan: true };
      assert.equal(classifyNodeKind(pureOrphan, 0, 0, 0), NODE_KINDS.ISOLATED);

      const unflaggedDisconnected = { id: 'lonely.js' };
      assert.equal(classifyNodeKind(unflaggedDisconnected, 0, 0, 0), NODE_KINDS.ISOLATED);
    });

    it('classifies test files when isTest flag is true', () => {
      const testNode = { id: 'foo.test.js', isTest: true };
      const kind = classifyNodeKind(testNode, 0, 1, 0);
      assert.equal(kind, NODE_KINDS.TEST);
    });

    it('classifies important modules when fanIn >= 2', () => {
      const highFanInNode = { id: 'core.js', isEntryCandidate: false, isTest: false };
      const kind = classifyNodeKind(highFanInNode, 2, 1, 0);
      assert.equal(kind, NODE_KINDS.IMPORTANT);
    });

    it('classifies normal modules when fanIn < 2 and not flagged', () => {
      const normalNode = { id: 'helper.js', isEntryCandidate: false, isTest: false };
      const kind = classifyNodeKind(normalNode, 1, 2, 0);
      assert.equal(kind, NODE_KINDS.NORMAL);
    });
  });

  it('exposes definitions and colors for all semantic kinds', () => {
    for (const kind of Object.values(NODE_KINDS)) {
      assert.ok(KIND_DEFINITIONS[kind], `Definition missing for ${kind}`);
      assert.ok(KIND_DEFINITIONS[kind].label);
      assert.ok(KIND_DEFINITIONS[kind].description);
      assert.ok(KIND_DEFINITIONS[kind].colorHex);
    }
  });
});
