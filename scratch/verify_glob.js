const path = require('path');
const fs = require('fs');
const { globSync } = require('glob');

const repoRoot = 'd:/Repolens/RepoLens/cloned-repos/69e37927124aee20a02146d3-DYP-AttendX';
const name = 'package.json';

const found = globSync([name, `*/${name}`], {
  cwd: repoRoot,
  ignore: ['node_modules/**', '.git/**'],
  nodir: true,
  posix: true
});

console.log('Found files:', found);
