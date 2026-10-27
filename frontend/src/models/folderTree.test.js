import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFolderTree } from './folderTree.js';

describe('folderTree', () => {
  it('returns empty array when given empty node list', () => {
    assert.deepEqual(buildFolderTree([]), []);
    assert.deepEqual(buildFolderTree(null), []);
  });

  it('correctly calculates recursive per-folder file counts and sorts folders before files', () => {
    const nodes = [
      { id: 'src/utils/math.js' },
      { id: 'src/utils/string.js' },
      { id: 'src/components/Button.jsx' },
      { id: 'src/index.js' },
      { id: 'README.md' },
      { id: 'package.json' },
    ];

    const tree = buildFolderTree(nodes);

    // Top level: folders first (src), then files (package.json, README.md)
    assert.equal(tree.length, 3);
    assert.equal(tree[0].name, 'src');
    assert.equal(tree[0].type, 'folder');
    assert.equal(tree[0].fileCount, 4);

    assert.equal(tree[1].name, 'package.json');
    assert.equal(tree[1].type, 'file');

    assert.equal(tree[2].name, 'README.md');
    assert.equal(tree[2].type, 'file');

    // Inside src: components (1), utils (2), index.js (1)
    const srcChildren = tree[0].children;
    assert.equal(srcChildren.length, 3);
    assert.equal(srcChildren[0].name, 'components');
    assert.equal(srcChildren[0].type, 'folder');
    assert.equal(srcChildren[0].fileCount, 1);

    assert.equal(srcChildren[1].name, 'utils');
    assert.equal(srcChildren[1].type, 'folder');
    assert.equal(srcChildren[1].fileCount, 2);

    assert.equal(srcChildren[2].name, 'index.js');
    assert.equal(srcChildren[2].type, 'file');
  });

  it('handles deep nesting efficiently', () => {
    const nodes = [
      { id: 'a/b/c/d/e/file1.js' },
      { id: 'a/b/c/d/e/file2.js' },
    ];

    const tree = buildFolderTree(nodes);
    assert.equal(tree.length, 1);
    assert.equal(tree[0].name, 'a');
    assert.equal(tree[0].fileCount, 2);

    let cur = tree[0];
    for (const seg of ['b', 'c', 'd', 'e']) {
      assert.equal(cur.children[0].name, seg);
      assert.equal(cur.children[0].fileCount, 2);
      cur = cur.children[0];
    }
    assert.equal(cur.children.length, 2);
    assert.equal(cur.children[0].name, 'file1.js');
    assert.equal(cur.children[1].name, 'file2.js');
  });

  it('handles backslashes gracefully by normalizing to forward slashes', () => {
    const nodes = [
      { id: 'src\\helpers\\format.js' },
    ];
    const tree = buildFolderTree(nodes);
    assert.equal(tree[0].name, 'src');
    assert.equal(tree[0].children[0].name, 'helpers');
    assert.equal(tree[0].children[0].children[0].name, 'format.js');
  });

  it('lists root files at the top level and never inside a folder named "."', () => {
    const nodes = [
      { id: 'index.js', folder: '.' },
      { id: './package.json', folder: '.' },
      { id: '.env.example', folder: '.' },
      { id: 'src/app.js', folder: 'src' },
    ];
    const tree = buildFolderTree(nodes);

    // Should have folder 'src' first, then top-level files
    assert.equal(tree[0].name, 'src');
    assert.equal(tree[0].type, 'folder');

    // No folder named "." should ever exist
    const hasDotFolder = tree.some(item => item.name === '.' && item.type === 'folder');
    assert.equal(hasDotFolder, false, 'Tree must not contain a folder named "."');

    // Root files must be top-level files
    const fileNames = tree.filter(item => item.type === 'file').map(item => item.name);
    assert.deepEqual(fileNames, ['.env.example', 'index.js', 'package.json']);
  });
});
