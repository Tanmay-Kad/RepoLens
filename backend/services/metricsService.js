import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const EXCLUDED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'out',
  'coverage',
  '.next',
  'vendor',
  'bower_components',
]);

export const SUPPORTED_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
]);

const FRAMEWORK_ALLOWLIST = [
  'react',
  'vue',
  'next',
  'express',
  'nestjs',
  'vite',
  'angular',
  'svelte',
  'mongoose',
  'tailwindcss',
  'fastify',
  'electron',
  'nuxt',
  'gatsby',
];

const CONFIG_FRAMEWORK_MAP = [
  { pattern: /(^|[/\\])vite\.config\.[^/\\]+$/i, framework: 'vite' },
  { pattern: /(^|[/\\])next\.config\.[^/\\]+$/i, framework: 'next' },
  { pattern: /(^|[/\\])tailwind\.config\.[^/\\]+$/i, framework: 'tailwindcss' },
  { pattern: /(^|[/\\])nuxt\.config\.[^/\\]+$/i, framework: 'nuxt' },
  { pattern: /(^|[/\\])svelte\.config\.[^/\\]+$/i, framework: 'svelte' },
];

export const METRIC_DEFINITIONS = {
  'files.total': 'Total files in the repository after excluding build artifacts, dependencies, and version control directories.',
  'files.supportedSource': 'Files matching analyzable JavaScript and TypeScript source extensions (.js, .jsx, .ts, .tsx, .mjs, .cjs).',
  'files.analyzedInGraph': 'Source files actively resolved and mapped as modules within the dependency graph.',
  'languages': 'Distribution of detected languages across repository files; analysis is supported exclusively for JavaScript and TypeScript.',
  'loc.total': 'Total physical lines of code across analyzable source files; comments and documentation are not separated.',
  'loc.blank': 'Physical blank or empty lines across analyzable source files.',
  'loc.nonBlank': 'Physical non-empty lines of code across analyzable source files.',
  'graph.nodes': 'Count of distinct modules participating in the dependency graph.',
  'graph.edges': 'Count of directional import/require relationships between modules.',
  'graph.circularCount': 'Count of distinct circular dependency loops detected in the codebase.',
  'graph.filesInCycles': 'Count of unique source files involved in one or more circular dependency cycles.',
  'hotspots': 'Top source files ranked by incoming dependent import count (fan-in).',
  'orphans': 'Source files with zero incoming and zero outgoing imports, isolated within the module graph (excluding entry points and tests).',
  'entryCandidates': 'Potential application entry points identified through package.json manifests, scripts, HTML tags, or conventions.',
  'frameworks': 'Application frameworks and key libraries verified through package.json dependencies or configuration files.',
  'packageManifests': 'All package.json manifest files discovered across root and workspace packages.',
};

/**
 * Normalizes any file path to forward slashes relative to rootDir.
 * @param {string} fullOrRelPath
 * @param {string} rootDir
 * @returns {string}
 */
export const normalizeRepoPath = (fullOrRelPath, rootDir) => {
  if (!fullOrRelPath) return '';
  let rel = path.isAbsolute(fullOrRelPath)
    ? path.relative(rootDir, fullOrRelPath)
    : fullOrRelPath;
  rel = rel.replace(/\\/g, '/');
  // Trim leading ./ if present
  if (rel.startsWith('./')) {
    rel = rel.slice(2);
  }
  return rel;
};

/**
 * Inspects a source file to measure physical line counts (total, blank, nonBlank).
 * Safely skips files > 1MB and files containing NUL bytes (binary).
 *
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<{ ok: boolean, total?: number, blank?: number, nonBlank?: number, reason?: string }>}
 */
export const countFileLoc = async (filePath) => {
  try {
    const stat = await fs.lstat(filePath);
    if (!stat.isFile()) {
      return { ok: false, reason: 'Not a regular file' };
    }
    if (stat.size > 1024 * 1024) {
      return { ok: false, reason: 'File size exceeds 1MB limit' };
    }

    // Check first 8KB for NUL bytes to detect binary files
    const fd = await fs.open(filePath, 'r');
    const headerBuffer = Buffer.alloc(Math.min(8192, stat.size));
    await fd.read(headerBuffer, 0, headerBuffer.length, 0);
    await fd.close();

    if (headerBuffer.includes(0)) {
      return { ok: false, reason: 'Binary content detected' };
    }

    const content = await fs.readFile(filePath, 'utf8');
    // Normalize CRLF to LF
    const normalized = content.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');

    // Handle trailing empty line after final newline
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    let blank = 0;
    let nonBlank = 0;
    for (const line of lines) {
      if (line.trim().length === 0) {
        blank++;
      } else {
        nonBlank++;
      }
    }

    return {
      ok: true,
      total: lines.length,
      blank,
      nonBlank,
    };
  } catch (err) {
    return { ok: false, reason: err?.message || 'Read error' };
  }
};

/**
 * Scans the repository directory tree collecting all files and manifests.
 * Skips excluded directories completely.
 *
 * @param {string} rootDir
 * @returns {Promise<{
 *   allFiles: Array<{ relPath: string, fullPath: string, ext: string, sizeBytes: number }>,
 *   manifestFiles: string[],
 *   htmlFiles: string[]
 * }>}
 */
export const walkRepoFiles = async (rootDir) => {
  const allFiles = [];
  const manifestFiles = [];
  const htmlFiles = [];

  const walk = async (currentDir) => {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (_) {
      return;
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        await walk(path.join(currentDir, entry.name));
      } else if (entry.isFile()) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = normalizeRepoPath(fullPath, rootDir);
        const ext = path.extname(entry.name).toLowerCase();

        let sizeBytes = 0;
        try {
          const s = fsSync.lstatSync(fullPath);
          sizeBytes = s.size;
        } catch (_) {}

        allFiles.push({ relPath, fullPath, ext, sizeBytes });

        if (entry.name === 'package.json') {
          manifestFiles.push(fullPath);
        } else if (ext === '.html' || ext === '.htm') {
          htmlFiles.push(fullPath);
        }
      }
    }
  };

  await walk(rootDir);
  return { allFiles, manifestFiles, htmlFiles };
};

/**
 * Maps extension to friendly language name.
 * @param {string} ext
 * @returns {string}
 */
const getLanguageName = (ext) => {
  const map = {
    '.js': 'JavaScript',
    '.mjs': 'JavaScript',
    '.cjs': 'JavaScript',
    '.jsx': 'JavaScript (React)',
    '.ts': 'TypeScript',
    '.tsx': 'TypeScript (React)',
    '.py': 'Python',
    '.java': 'Java',
    '.go': 'Go',
    '.rs': 'Rust',
    '.rb': 'Ruby',
    '.php': 'PHP',
    '.c': 'C',
    '.h': 'C/C++ Header',
    '.cpp': 'C++',
    '.hpp': 'C++ Header',
    '.cs': 'C#',
    '.html': 'HTML',
    '.htm': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'Sass',
    '.less': 'Less',
    '.json': 'JSON',
    '.md': 'Markdown',
    '.yaml': 'YAML',
    '.yml': 'YAML',
    '.sh': 'Shell',
    '.bash': 'Shell',
    '.sql': 'SQL',
    '.graphql': 'GraphQL',
    '.svg': 'SVG',
  };
  if (map[ext]) return map[ext];
  if (!ext) return 'No Extension';
  return ext.replace('.', '').toUpperCase();
};

/**
 * Extracts framework evidence from package.json files and config files.
 * @param {string[]} manifestFiles - Absolute paths to package.json files
 * @param {Array<{ relPath: string, fullPath: string }>} allFiles
 * @param {string} rootDir
 * @returns {Promise<Array<{ name: string, evidencePath: string }>>}
 */
export const detectFrameworks = async (manifestFiles, allFiles, rootDir) => {
  const frameworksFound = new Map();

  for (const manifestPath of manifestFiles) {
    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      const json = JSON.parse(content);
      const relManifest = normalizeRepoPath(manifestPath, rootDir);

      const allDeps = {
        ...json.dependencies,
        ...json.devDependencies,
        ...json.peerDependencies,
      };

      for (const fw of FRAMEWORK_ALLOWLIST) {
        if (allDeps[fw] || Object.keys(allDeps).some(d => d === fw || d.startsWith(`@${fw}/`))) {
          if (!frameworksFound.has(fw)) {
            frameworksFound.set(fw, new Set());
          }
          frameworksFound.get(fw).add(relManifest);
        }
      }
    } catch (_) {
      // Ignore malformed manifest
    }
  }

  // Check config files
  for (const file of allFiles) {
    for (const rule of CONFIG_FRAMEWORK_MAP) {
      if (rule.pattern.test(file.relPath)) {
        if (!frameworksFound.has(rule.framework)) {
          frameworksFound.set(rule.framework, new Set());
        }
        frameworksFound.get(rule.framework).add(file.relPath);
      }
    }
  }

  const results = [];
  for (const [name, pathsSet] of frameworksFound.entries()) {
    for (const evidencePath of pathsSet) {
      results.push({ name, evidencePath });
    }
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Discovers candidate entry points based strictly on evidence.
 *
 * @param {string[]} manifestFiles
 * @param {string[]} htmlFiles
 * @param {Array<{ relPath: string }>} allFiles
 * @param {string} rootDir
 * @returns {Promise<Array<{ id: string, label: string, evidence: string }>>}
 */
export const detectEntryCandidates = async (manifestFiles, htmlFiles, allFiles, rootDir) => {
  const candidatesMap = new Map();
  const fileSet = new Set(allFiles.map(f => f.relPath));

  const resolveTargetFile = (relCandidate, baseDir = '') => {
    let target = path.join(baseDir, relCandidate).replace(/\\/g, '/');
    if (target.startsWith('./')) target = target.slice(2);
    if (fileSet.has(target)) return target;

    // Check with extensions if omitted
    for (const ext of SUPPORTED_EXTENSIONS) {
      if (fileSet.has(target + ext)) return target + ext;
      if (fileSet.has(`${target}/index${ext}`)) return `${target}/index${ext}`;
    }
    return null;
  };

  // 1. Evidence from package.json manifests
  for (const manifestPath of manifestFiles) {
    try {
      const content = await fs.readFile(manifestPath, 'utf8');
      const json = JSON.parse(content);
      const manifestDir = normalizeRepoPath(path.dirname(manifestPath), rootDir);

      if (typeof json.main === 'string') {
        const resolved = resolveTargetFile(json.main, manifestDir);
        if (resolved && !candidatesMap.has(resolved)) {
          candidatesMap.set(resolved, {
            id: resolved,
            label: path.basename(resolved),
            evidence: 'package.json main',
          });
        }
      }

      if (typeof json.module === 'string') {
        const resolved = resolveTargetFile(json.module, manifestDir);
        if (resolved && !candidatesMap.has(resolved)) {
          candidatesMap.set(resolved, {
            id: resolved,
            label: path.basename(resolved),
            evidence: 'package.json module',
          });
        }
      }

      if (typeof json.bin === 'string') {
        const resolved = resolveTargetFile(json.bin, manifestDir);
        if (resolved && !candidatesMap.has(resolved)) {
          candidatesMap.set(resolved, {
            id: resolved,
            label: path.basename(resolved),
            evidence: 'package.json bin',
          });
        }
      } else if (typeof json.bin === 'object' && json.bin !== null) {
        for (const [binName, binPath] of Object.entries(json.bin)) {
          if (typeof binPath === 'string') {
            const resolved = resolveTargetFile(binPath, manifestDir);
            if (resolved && !candidatesMap.has(resolved)) {
              candidatesMap.set(resolved, {
                id: resolved,
                label: path.basename(resolved),
                evidence: `package.json bin (${binName})`,
              });
            }
          }
        }
      }

      // Scripts running node <file>
      if (json.scripts && typeof json.scripts === 'object') {
        for (const [scriptName, scriptCmd] of Object.entries(json.scripts)) {
          if (typeof scriptCmd === 'string') {
            const match = scriptCmd.match(/\bnode\s+(?:--[^\s]+\s+)*([^\s;&|]+)/);
            if (match && match[1]) {
              const resolved = resolveTargetFile(match[1], manifestDir);
              if (resolved && !candidatesMap.has(resolved)) {
                candidatesMap.set(resolved, {
                  id: resolved,
                  label: path.basename(resolved),
                  evidence: `package.json script: "${scriptName}"`,
                });
              }
            }
          }
        }
      }
    } catch (_) {}
  }

  // 2. Evidence from HTML script tags
  for (const htmlPath of htmlFiles) {
    try {
      const content = await fs.readFile(htmlPath, 'utf8');
      const htmlDir = normalizeRepoPath(path.dirname(htmlPath), rootDir);
      const scriptTagRegex = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
      let match;
      while ((match = scriptTagRegex.exec(content)) !== null) {
        const src = match[1];
        if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('//')) {
          const cleanSrc = src.startsWith('/') ? src.slice(1) : src;
          const resolved = resolveTargetFile(cleanSrc, htmlDir) || resolveTargetFile(cleanSrc, '');
          if (resolved && !candidatesMap.has(resolved)) {
            candidatesMap.set(resolved, {
              id: resolved,
              label: path.basename(resolved),
              evidence: `HTML script tag in ${normalizeRepoPath(htmlPath, rootDir)}`,
            });
          }
        }
      }
    } catch (_) {}
  }

  // 3. Evidence from conventional entry names at root or in src/
  const conventionalBasenames = ['index', 'main', 'app', 'server'];
  for (const file of allFiles) {
    const ext = file.ext;
    if (!SUPPORTED_EXTENSIONS.has(ext)) continue;
    const baseWithoutExt = path.basename(file.relPath, ext);
    if (!conventionalBasenames.includes(baseWithoutExt)) continue;

    const dir = path.dirname(file.relPath).replace(/\\/g, '/');
    if (dir === '.' || dir === 'src' || dir === 'lib' || dir === 'app') {
      if (!candidatesMap.has(file.relPath)) {
        candidatesMap.set(file.relPath, {
          id: file.relPath,
          label: path.basename(file.relPath),
          evidence: `Conventional entry name in ${dir === '.' ? 'root' : dir + '/'}`,
        });
      }
    }
  }

  return Array.from(candidatesMap.values());
};

/**
 * Computes all defined metrics and enriches graph nodes.
 * Pure function: receives raw graph, repo files, and root path.
 *
 * @param {object} params
 * @param {string} params.rootDir
 * @param {object} params.rawTree - Object mapping file -> array of deps from Madge
 * @param {Array<string[]>} params.circular - Cycles from Madge
 * @param {Array<{ relPath: string, fullPath: string, ext: string, sizeBytes: number }>} params.allFiles
 * @param {string[]} params.manifestFiles
 * @param {string[]} params.htmlFiles
 * @param {string[]} [params.madgeWarnings]
 * @returns {Promise<{
 *   graphData: { nodes: any[], edges: any[], circular: any[] },
 *   metrics: object,
 *   analysis: object
 * }>}
 */
export const computeRepoMetrics = async ({
  rootDir,
  rawTree = {},
  circular = [],
  allFiles = [],
  manifestFiles = [],
  htmlFiles = [],
  madgeWarnings = [],
}) => {
  // 1. Files metrics
  const totalFilesCount = allFiles.length;
  const supportedSourceFiles = allFiles.filter(f => SUPPORTED_EXTENSIONS.has(f.ext));
  const supportedSourceCount = supportedSourceFiles.length;

  // 2. Languages distribution
  const langCountMap = new Map();
  for (const file of allFiles) {
    const ext = file.ext || '(no-ext)';
    const lang = getLanguageName(file.ext);
    const key = `${lang}|${ext}`;
    langCountMap.set(key, (langCountMap.get(key) || 0) + 1);
  }

  const languages = [];
  const unsupportedSummary = [];
  for (const [key, count] of langCountMap.entries()) {
    const [language, extension] = key.split('|');
    const isSupported = SUPPORTED_EXTENSIONS.has(extension);
    languages.push({
      language,
      extension,
      count,
      analysisSupported: isSupported,
    });
    if (!isSupported) {
      unsupportedSummary.push({ language, count });
    }
  }
  languages.sort((a, b) => b.count - a.count);
  unsupportedSummary.sort((a, b) => b.count - a.count);

  // 3. LOC calculation
  let locTotal = 0;
  let locBlank = 0;
  let locNonBlank = 0;
  const skippedFiles = [];
  const fileLocMap = new Map();

  for (const file of supportedSourceFiles) {
    const res = await countFileLoc(file.fullPath);
    if (res.ok) {
      locTotal += res.total;
      locBlank += res.blank;
      locNonBlank += res.nonBlank;
      fileLocMap.set(file.relPath, {
        total: res.total,
        blank: res.blank,
        nonBlank: res.nonBlank,
      });
    } else {
      skippedFiles.push({
        path: file.relPath,
        reason: res.reason,
      });
    }
  }

  const loc = supportedSourceCount > 0 ? {
    total: locTotal,
    blank: locBlank,
    nonBlank: locNonBlank,
    skippedFilesCount: skippedFiles.length,
    skippedFiles: skippedFiles.slice(0, 50),
  } : null;

  // 4. Graph structure and degree calculation
  const nodeSet = new Set(Object.keys(rawTree).map(k => normalizeRepoPath(k, rootDir)));
  const edges = [];
  const fanInMap = new Map();
  const fanOutMap = new Map();

  // Initialize degree maps
  for (const node of nodeSet) {
    fanInMap.set(node, 0);
    fanOutMap.set(node, 0);
  }

  for (const [rawSource, rawTargets] of Object.entries(rawTree)) {
    const source = normalizeRepoPath(rawSource, rootDir);
    if (!Array.isArray(rawTargets)) continue;

    for (const rawTarget of rawTargets) {
      const target = normalizeRepoPath(rawTarget, rootDir);
      edges.push({ source, target });

      fanOutMap.set(source, (fanOutMap.get(source) || 0) + 1);
      nodeSet.add(target);
      fanInMap.set(target, (fanInMap.get(target) || 0) + 1);
      if (!fanOutMap.has(target)) {
        fanOutMap.set(target, 0);
      }
    }
  }

  // 5. Entry Candidates & Frameworks
  const entryCandidates = await detectEntryCandidates(manifestFiles, htmlFiles, allFiles, rootDir);
  const entryCandidateMap = new Map(entryCandidates.map(e => [e.id, e.evidence]));

  const frameworks = await detectFrameworks(manifestFiles, allFiles, rootDir);

  // 6. Enrich nodes
  const testRegex = /(^|[._\-/])(test|spec)($|[._\-/])|(__tests__|tests|test)[/\\]/i;
  const configRegex = /(^|[/\\])[^/\\]+\.config\.[^/\\]+$|\.eslintrc|\.prettierrc|tsconfig|jsconfig/i;

  const nodes = [];
  const allFilesMap = new Map(allFiles.map(f => [f.relPath, f]));

  for (const id of nodeSet) {
    const fanIn = fanInMap.get(id) || 0;
    const fanOut = fanOutMap.get(id) || 0;
    const isOrphan = fanIn === 0 && fanOut === 0;
    const isTest = testRegex.test(id);
    const hasEntryReason = entryCandidateMap.get(id) || null;
    const fileInfo = allFilesMap.get(id);

    nodes.push({
      id,
      label: path.basename(id),
      ext: path.extname(id).toLowerCase(),
      folder: path.dirname(id).replace(/\\/g, '/'),
      loc: fileLocMap.get(id)?.total ?? null,
      sizeBytes: fileInfo?.sizeBytes ?? null,
      fanIn,
      fanOut,
      isOrphan,
      isEntryCandidate: Boolean(hasEntryReason),
      entryReason: hasEntryReason,
      isTest,
    });
  }

  // Sort nodes deterministically
  nodes.sort((a, b) => a.id.localeCompare(b.id));

  // 7. Hotspots (top 10 by fanIn, breaking ties by id)
  const hotspots = [...nodes]
    .filter(n => n.fanIn > 0)
    .sort((a, b) => b.fanIn - a.fanIn || a.id.localeCompare(b.id))
    .slice(0, 10)
    .map(n => ({
      id: n.id,
      label: n.label,
      fanIn: n.fanIn,
      fanOut: n.fanOut,
    }));

  // 8. Orphans: isolated in import graph, excluding entry candidates, tests, and config files
  const orphans = nodes
    .filter(n => n.isOrphan && !n.isEntryCandidate && !n.isTest && !configRegex.test(n.id))
    .map(n => ({
      id: n.id,
      label: n.label,
      folder: n.folder,
      status: 'isolated in the import graph',
    }));

  // 9. Circular dependency details
  const normalizedCircular = circular.map(cycle =>
    cycle.map(f => normalizeRepoPath(f, rootDir))
  );
  const filesInCyclesSet = new Set(normalizedCircular.flat());

  // 10. Package manifests list (cap 50)
  const packageManifests = manifestFiles
    .map(p => normalizeRepoPath(p, rootDir))
    .slice(0, 50);

  // 11. Warnings capping
  const allWarnings = [
    ...(madgeWarnings || []).map(w => `Madge skipped unresolved import: ${w}`),
    ...(loc === null && supportedSourceCount === 0 ? ['No JavaScript or TypeScript source files found to analyze.'] : []),
  ];
  const cappedWarnings = allWarnings.slice(0, 50);
  const remainderWarningsCount = Math.max(0, allWarnings.length - 50);

  const metrics = {
    files: {
      total: totalFilesCount,
      supportedSource: supportedSourceCount,
      analyzedInGraph: nodes.length,
      excludedDirs: Array.from(EXCLUDED_DIRS),
    },
    languages,
    loc,
    graph: {
      nodes: nodes.length,
      edges: edges.length,
      circularCount: normalizedCircular.length,
      filesInCycles: filesInCyclesSet.size,
    },
    hotspots,
    orphans,
    entryCandidates,
    frameworks,
    packageManifests,
  };

  const analysis = {
    analyzerVersion: 1,
    analyzedAt: new Date().toISOString(),
    warnings: cappedWarnings,
    remainderWarningsCount,
    unsupported: unsupportedSummary,
    large: nodes.length > 2000,
  };

  const graphData = {
    nodes,
    edges,
    circular: normalizedCircular,
  };

  return {
    graphData,
    metrics,
    analysis,
  };
};

export default {
  walkRepoFiles,
  countFileLoc,
  detectFrameworks,
  detectEntryCandidates,
  computeRepoMetrics,
  normalizeRepoPath,
  METRIC_DEFINITIONS,
  EXCLUDED_DIRS,
  SUPPORTED_EXTENSIONS,
};
