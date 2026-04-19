import { performAnalysis } from '../services/analyzeService.js';
import Repository from '../models/Repository.js';
import { simpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';
import madge from 'madge';
import { glob } from 'glob';

export const analyzeRepository = async (req, res) => {
  console.log('Incoming Payload:', req.body);
  const url = req.body.url || req.body.repoUrl || req.body.githubUrl;

  if (!url || !url.includes('github.com')) {
    return res.status(400).json({ error: 'Valid GitHub URL is required.' });
  }

  try {
    console.log(`[Analyze] Starting analysis for URL: ${url}`);
    const git = simpleGit();
    
    // Validate repository
    console.log(`[Analyze] Validating remote repository...`);
    try {
      const remoteInfo = await git.listRemote([url]);
      if (!remoteInfo || remoteInfo.trim() === '') {
        return res.status(400).json({ error: 'Repository is empty or invalid.' });
      }
    } catch (err) {
      return res.status(400).json({ error: 'Repository is private or invalid.' });
    }

    // Check if we already analyzed and cloned this repo — return cached result instantly
    let repo = await Repository.findOne({ url });
    if (repo && repo.cloneStatus === 'completed' && repo.localPath && fs.existsSync(repo.localPath)) {
      return res.status(200).json({
        message: 'Analysis complete (cached)',
        data: repo,
        success: true,
        repoId: repo._id,
        localPath: repo.localPath
      });
    }

    if (!repo) {
      repo = new Repository({ url, status: 'pending', cloneStatus: 'pending' });
      await repo.save();
    }

    repo.status = 'analyzing';
    await repo.save();
    console.log(`[Analyze] Database record created/updated. Status: analyzing`);

    const analysisResult = await performAnalysis(url);
    console.log(`[Analyze] Static analysis (mock) complete.`);
    
    repo.status = 'completed';
    repo.metrics = analysisResult;
    await repo.save();
    console.log(`[Analyze] Metrics saved to database.`);

    // Clone Repository
    console.log(`[Analyze] Preparing to clone repository...`);
    repo.cloneStatus = 'cloning';
    await repo.save();

    // Ensure the parent directory exists
    const projectRoot = path.join(process.cwd(), '..');
    const parentDir = path.join(projectRoot, 'cloned-repos');
    if (!fs.existsSync(parentDir)) {
      console.log(`[Analyze] Creating parent directory: ${parentDir}`);
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const repoName = url.split('/').pop().replace('.git', '');
    const cloneDir = path.join(parentDir, `${repo.id}-${repoName}`);
    console.log(`[Analyze] Target clone directory: ${cloneDir}`);

    // If the directory already exists (e.g. from a previous cancelled run), remove it
    if (fs.existsSync(cloneDir)) {
      console.log(`[Analyze] Cleaning up existing directory...`);
      fs.rmSync(cloneDir, { recursive: true, force: true });
    }

    try {
      console.log(`[Analyze] Starting git clone (shallow)...`);
      // Use shallow clone to make copying large repositories much faster
      await git.clone(url, cloneDir, ['--depth', '1', '--single-branch']);
      console.log(`[Analyze] Clone successful.`);
      repo.localPath = cloneDir;
      repo.cloneStatus = 'completed';
      await repo.save();
    } catch (cloneErr) {
      console.error('Clone error detailed:', cloneErr);
      repo.cloneStatus = 'failed';
      await repo.save();
      return res.status(500).json({ 
        error: 'Failed to clone repository', 
        details: cloneErr.message,
        command: cloneErr.command
      });
    }

    res.status(200).json({ 
      message: 'Analysis complete',
      data: repo,
      success: true, 
      repoId: repo._id, 
      localPath: repo.localPath
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to process repository' });
  }
};

import mongoose from 'mongoose';

// ─── Config file scanner (shared helper) ──────────────────────────────────────

const ROOT_CONFIG_FILES = [
  { name: 'package.json',        type: 'pkg' },
  { name: 'package-lock.json',   type: 'pkg-lock' },
  { name: 'yarn.lock',           type: 'pkg-lock' },
  { name: 'tsconfig.json',       type: 'tsconfig' },
  { name: 'tsconfig.base.json',  type: 'tsconfig' },
  { name: 'jsconfig.json',       type: 'jsconfig' },
  { name: 'vite.config.js',      type: 'vite' },
  { name: 'vite.config.ts',      type: 'vite' },
  { name: 'webpack.config.js',   type: 'webpack' },
  { name: 'webpack.config.ts',   type: 'webpack' },
  { name: '.env.example',        type: 'env' },
  { name: '.env.local',          type: 'env' },
  { name: '.babelrc',            type: 'babel' },
  { name: 'babel.config.js',     type: 'babel' },
  { name: 'babel.config.json',   type: 'babel' },
  { name: '.eslintrc',           type: 'eslint' },
  { name: '.eslintrc.js',        type: 'eslint' },
  { name: '.eslintrc.json',      type: 'eslint' },
  { name: 'eslint.config.js',    type: 'eslint' },
  { name: '.prettierrc',         type: 'prettier' },
  { name: '.prettierrc.json',    type: 'prettier' },
  { name: 'prettier.config.js',  type: 'prettier' },
  { name: 'jest.config.js',      type: 'jest' },
  { name: 'jest.config.ts',      type: 'jest' },
  { name: 'vitest.config.js',    type: 'vitest' },
  { name: 'vitest.config.ts',    type: 'vitest' },
  { name: 'tailwind.config.js',  type: 'tailwind' },
  { name: 'tailwind.config.ts',  type: 'tailwind' },
  { name: 'postcss.config.js',   type: 'postcss' },
  { name: 'next.config.js',      type: 'next' },
  { name: 'next.config.ts',      type: 'next' },
  { name: 'nuxt.config.js',      type: 'nuxt' },
  { name: 'svelte.config.js',    type: 'svelte' },
  { name: 'rollup.config.js',    type: 'rollup' },
  { name: 'Dockerfile',          type: 'docker' },
  { name: '.travis.yml',         type: 'ci' },
  { name: 'Makefile',            type: 'make' },
];

const ENTRY_NAMES = [
  'index.js','index.ts','index.jsx','index.tsx',
  'main.js','main.ts','main.jsx','main.tsx',
  'app.js','app.ts','app.jsx','app.tsx',
  'server.js','server.ts',
];

async function buildConfigOverlay(repoRoot, sourceNodes) {
  const configNodes = [];
  const configEdges = [];
  const sourceIds   = sourceNodes.map(n => n.id);

  console.log(`[Config] Scanning root: ${repoRoot}`);
  console.log(`[Config] Source node count: ${sourceIds.length}`);

  for (const { name, type } of ROOT_CONFIG_FILES) {
    // Search for config files up to 3 levels deep (e.g., root, backend/, or packages/core/package.json)
    // depth: root, level 1 (*/), level 2 (*/*/)
    let found = [];
    try {
      found = await glob([name, `*/${name}`, `*/*/${name}`], {
        cwd: repoRoot,
        ignore: ['**/node_modules/**', '**/.git/**'],
        nodir: true,
        posix: true
      });
    } catch (err) {
      console.error(`[Config] Glob error for ${name}:`, err);
      continue;
    }

    for (const relPath of found) {
      console.log(`[Config] FOUND: ${relPath} (${type})`);

      const nodeId = `__config__/${relPath}`;
      const parentDir = path.dirname(relPath); // e.g., 'backend' or '.'

      configNodes.push({
        id:       nodeId,
        label:    path.basename(relPath),
        type,
        isConfig: true,
        filePath: relPath,
      });

      // Normalise slashes before basename extraction (Windows safe)
      const bn = (id) => id.replace(/\\/g, '/').split('/').pop();
      const normalize = (p) => p.replace(/\\/g, '/');

      // Filter source files that are in the same directory as the config file
      const localSourceIds = sourceIds.filter(id => {
        const normId = normalize(id);
        if (parentDir === '.') {
          // If config is at root, connect to root entry points (no slashes in path usually)
          return !normId.includes('/'); 
        }
        // If config is in 'backend/', connect to files in 'backend/...'
        return normId.startsWith(`${parentDir}/`);
      });

      // If no local sources (e.g., empty dir or different structure), fallback to all sources for root configs
      const targetPool = localSourceIds.length > 0 ? localSourceIds : (parentDir === '.' ? sourceIds : []);

      if (type === 'pkg') {
        targetPool
          .filter(id => ENTRY_NAMES.includes(bn(id)))
          .forEach(target => configEdges.push({ source: nodeId, target }));
      } else if (type === 'pkg-lock') {
        targetPool
          .filter(id => bn(id) === 'package.json')
          .forEach(target => configEdges.push({ source: nodeId, target }));
      } else if (type === 'tsconfig' || type === 'jsconfig') {
        targetPool
          .filter(id => /\.(ts|tsx)$/i.test(id))
          .slice(0, 30)
          .forEach(target => configEdges.push({ source: nodeId, target }));
      } else if (['vite','next','nuxt','svelte'].includes(type) || type === 'webpack' || type === 'rollup') {
        targetPool
          .filter(id => ENTRY_NAMES.includes(bn(id)))
          .forEach(target => configEdges.push({ source: nodeId, target }));
      } else if (['jest','vitest'].includes(type)) {
        targetPool
          .filter(id => /\.(test|spec)\.(js|ts|jsx|tsx)$/i.test(id))
          .slice(0, 15)
          .forEach(target => configEdges.push({ source: nodeId, target }));
      } else if (['eslint','prettier'].includes(type)) {
        targetPool
          .filter(id => /\.(js|ts|jsx|tsx)$/i.test(id))
          .slice(0, 15)
          .forEach(target => configEdges.push({ source: nodeId, target }));
      }
    }
  }

  console.log(`[Config] Total config nodes injected: ${configNodes.length}`);
  return { configNodes, configEdges };
}



export const getGraphData = async (req, res) => {
  const { repoId } = req.params;

  try {
    // Prevent Mongoose CastError crashing the scope by validating ObjectId
    if (!mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ error: 'Invalid repository ID format.' });
    }

    const repo = await Repository.findById(repoId);
    if (!repo) {
      return res.status(404).json({ error: 'Repository not found.' });
    }

    if (!repo.localPath || !fs.existsSync(repo.localPath)) {
      return res.status(400).json({ error: 'Repository clone not available for analysis.' });
    }

    const absoluteLocalPath = path.resolve(repo.localPath);

    // Check if graph data already generated — load from cache then append fresh config nodes
    if (repo.graphData && repo.graphData.nodes && repo.graphData.nodes.length > 0) {
      const sourceNodes = repo.graphData.nodes;
      const { configNodes, configEdges } = await buildConfigOverlay(absoluteLocalPath, sourceNodes);
      return res.status(200).json({ 
        nodes: [...sourceNodes, ...configNodes], 
        edges: [...repo.graphData.edges, ...configEdges],
        circular: repo.graphData.circular
      });
    }

    console.log(`[Graph] Starting Madge analysis on resolved path: ${absoluteLocalPath}`);

    // Generate graph using Madge
    let resMadge;
    try {
      console.log(`[Graph] Invoking Madge...`);
      resMadge = await madge(absoluteLocalPath, {
        includeNpm: false,
        fileExtensions: ['js', 'jsx', 'ts', 'tsx']
      });
      console.log(`[Graph] Madge analysis complete.`);
    } catch (madgeErr) {
      console.error('Madge initialization specifically failed:', madgeErr);
      return res.status(500).json({ error: 'Madge analysis failed', details: madgeErr.message });
    }

    const obj      = resMadge.obj();
    const circular = resMadge.circular();

    const nodes = [];
    const edges = [];

    const fileKeys = Object.keys(obj);
    for (const file of fileKeys) {
      nodes.push({ id: file }); 
      const deps = obj[file];
      for (const target of deps) {
        edges.push({ source: file, target });
      }
    }

    // Save only Madge output to DB (config nodes are always injected fresh)
    repo.graphData = { nodes, edges, circular };
    await repo.save();

    // Append config nodes fresh
    const { configNodes, configEdges } = await buildConfigOverlay(absoluteLocalPath, nodes);

    res.status(200).json({
      nodes: [...nodes, ...configNodes],
      edges: [...edges, ...configEdges],
      circular,
    });

  } catch (error) {
    console.error('Graph extraction error:', error);
    res.status(500).json({ error: 'Failed to extract dependency graph' });
  }
};


// ─── Configuration File Detection ─────────────────────────────────────────────

/**
 * Well-known config file patterns and their "type" label.
 * The type is used by the frontend to pick the right colour / shape.
 */
const CONFIG_FILE_PATTERNS = [
  { pattern: 'package.json',        type: 'pkg',       label: 'package.json' },
  { pattern: 'package-lock.json',   type: 'pkg-lock',  label: 'package-lock.json' },
  { pattern: 'yarn.lock',           type: 'pkg-lock',  label: 'yarn.lock' },
  { pattern: 'tsconfig*.json',      type: 'tsconfig',  label: 'tsconfig' },
  { pattern: 'jsconfig.json',       type: 'jsconfig',  label: 'jsconfig.json' },
  { pattern: 'vite.config.*',       type: 'vite',      label: 'vite.config' },
  { pattern: 'webpack.config.*',    type: 'webpack',   label: 'webpack.config' },
  { pattern: 'babel.config.*',      type: 'babel',     label: 'babel.config' },
  { pattern: '.babelrc*',           type: 'babel',     label: '.babelrc' },
  { pattern: '.eslintrc*',          type: 'eslint',    label: '.eslintrc' },
  { pattern: 'eslint.config.*',     type: 'eslint',    label: 'eslint.config' },
  { pattern: '.prettierrc*',        type: 'prettier',  label: '.prettierrc' },
  { pattern: 'prettier.config.*',   type: 'prettier',  label: 'prettier.config' },
  { pattern: '.env.example',        type: 'env',       label: '.env.example' },
  { pattern: '.env.local',          type: 'env',       label: '.env.local' },
  { pattern: 'jest.config.*',       type: 'jest',      label: 'jest.config' },
  { pattern: 'vitest.config.*',     type: 'vitest',    label: 'vitest.config' },
  { pattern: 'tailwind.config.*',   type: 'tailwind',  label: 'tailwind.config' },
  { pattern: 'postcss.config.*',    type: 'postcss',   label: 'postcss.config' },
  { pattern: 'next.config.*',       type: 'next',      label: 'next.config' },
  { pattern: 'nuxt.config.*',       type: 'nuxt',      label: 'nuxt.config' },
  { pattern: 'svelte.config.*',     type: 'svelte',    label: 'svelte.config' },
  { pattern: 'rollup.config.*',     type: 'rollup',    label: 'rollup.config' },
  { pattern: 'dockerfile',          type: 'docker',    label: 'Dockerfile' },
  { pattern: 'docker-compose*.yml', type: 'docker',    label: 'docker-compose' },
  { pattern: '.github/**/*.yml',    type: 'ci',        label: 'GitHub Actions' },
  { pattern: '.travis.yml',         type: 'ci',        label: '.travis.yml' },
  { pattern: 'Makefile',            type: 'make',      label: 'Makefile' },
];

/**
 * Infer which source files a config file "governs" so we can draw edges.
 * Returns an array of relative file paths (IDs that already exist in graphNodes).
 */
function inferConfigEdges(configFileRel, configType, allSourceIds, repoRoot) {
  const edges = [];

  // Helper: find source-file IDs matching a filter
  const find = (filter) => allSourceIds.filter(filter);

  switch (configType) {
    case 'pkg': {
      // Connect to every entry-point-ish file
      const entries = find(id => {
        const base = path.basename(id).toLowerCase();
        return ['index.js','index.ts','index.jsx','index.tsx',
                'main.js','main.ts','main.jsx','main.tsx',
                'app.js','app.ts','app.jsx','app.tsx',
                'server.js','server.ts'].includes(base);
      });
      entries.forEach(e => edges.push({ source: configFileRel, target: e }));
      break;
    }
    case 'pkg-lock':
      // Connect to package.json if present
      find(id => path.basename(id) === 'package.json')
        .forEach(e => edges.push({ source: configFileRel, target: e }));
      break;
    case 'tsconfig':
    case 'jsconfig': {
      // Connect to all .ts/.tsx source files (limit to first 30 to keep graph clean)
      const tsFiles = find(id => /\.(ts|tsx)$/i.test(id)).slice(0, 30);
      tsFiles.forEach(e => edges.push({ source: configFileRel, target: e }));
      break;
    }
    case 'vite':
    case 'next':
    case 'nuxt':
    case 'svelte':{
      // Connect to all front-end entry points
      const fe = find(id => {
        const base = path.basename(id).toLowerCase();
        return ['main.jsx','main.tsx','main.js','main.ts',
                'index.jsx','index.tsx','app.jsx','app.tsx',
                '_app.js','_app.tsx'].includes(base);
      });
      fe.forEach(e => edges.push({ source: configFileRel, target: e }));
      break;
    }
    case 'webpack':
    case 'rollup': {
      // Webpack/Rollup governs entry files
      const entries = find(id => {
        const base = path.basename(id).toLowerCase();
        return ['index.js','main.js','app.js'].includes(base);
      });
      entries.forEach(e => edges.push({ source: configFileRel, target: e }));
      break;
    }
    case 'jest':
    case 'vitest': {
      // Connect test runner configs to .test.* / .spec.* files (first 20)
      const tests = find(id => /\.(test|spec)\.(js|ts|jsx|tsx)$/i.test(id)).slice(0, 20);
      tests.forEach(e => edges.push({ source: configFileRel, target: e }));
      break;
    }
    case 'eslint':
    case 'prettier': {
      // Very broad — connect to all JS/TS source files up to 20
      const srcs = find(id => /\.(js|ts|jsx|tsx)$/i.test(id)).slice(0, 20);
      srcs.forEach(e => edges.push({ source: configFileRel, target: e }));
      break;
    }
    // env, docker, ci, tailwind, postcss, babel, make → no automatic edges
    default:
      break;
  }

  return edges;
}

export const getConfigData = async (req, res) => {
  const { repoId } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(repoId)) {
      return res.status(400).json({ error: 'Invalid repository ID format.' });
    }

    const repo = await Repository.findById(repoId);
    if (!repo) return res.status(404).json({ error: 'Repository not found.' });

    if (!repo.localPath || !fs.existsSync(repo.localPath)) {
      return res.status(400).json({ error: 'Repository clone not available.' });
    }

    const absoluteLocalPath = path.resolve(repo.localPath);

    // Collect all source-file IDs already in the dependency graph
    const allSourceIds = (repo.graphData?.nodes || []).map(n => n.id);

    const configNodes = [];
    const configEdges = [];
    const seen = new Set();

    for (const { pattern, type, label } of CONFIG_FILE_PATTERNS) {
      // Use glob to find matching files (non-recursive for most, depth-2 max)
      let found = [];
      try {
        found = await glob(pattern, {
          cwd: absoluteLocalPath,
          nocase: true,
          dot: true,
          nodir: true,
          ignore: ['**/node_modules/**', '**/.git/**'],
        });
      } catch (_) {
        /* glob may fail on ill-formed patterns — silently skip */
      }

      for (const rel of found) {
        const nodeId = `__config__/${rel.replace(/\\/g, '/')}`;
        if (seen.has(nodeId)) continue;
        seen.add(nodeId);

        configNodes.push({
          id:    nodeId,
          label: path.basename(rel),
          type,
          isConfig: true,
          filePath: rel.replace(/\\/g, '/'),
        });

        // Infer edges from this config file to existing source nodes
        const relNorm = rel.replace(/\\/g, '/');
        const edges = inferConfigEdges(relNorm, type, allSourceIds, absoluteLocalPath);
        edges.forEach(e => configEdges.push({
          source: nodeId,
          target: e.target,
        }));
      }
    }

    return res.status(200).json({ configNodes, configEdges });
  } catch (error) {
    console.error('Config extraction error:', error);
    res.status(500).json({ error: 'Failed to extract configuration files' });
  }
};
