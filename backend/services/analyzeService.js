import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Directories to always skip when walking the repo
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'out', '.cache', 'coverage']);

// File extensions considered "source code" for LOC / complexity counting
const CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.cs', '.rb', '.php', '.swift', '.kt']);

/**
 * Recursively collects all file paths under `dir`, skipping IGNORED_DIRS.
 */
function walkDir(dir, fileList = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return fileList;
  }
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

/**
 * Detects the tech stack by inspecting package.json and well-known config/lock files.
 */
function detectTechStack(localPath) {
  const stack = new Set();

  const pkgPath = path.join(localPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      stack.add('Node.js');
      if (deps['react'])           stack.add('React');
      if (deps['vue'])             stack.add('Vue');
      if (deps['@angular/core'])   stack.add('Angular');
      if (deps['svelte'])          stack.add('Svelte');
      if (deps['next'])            stack.add('Next.js');
      if (deps['nuxt'])            stack.add('Nuxt.js');
      if (deps['express'])         stack.add('Express');
      if (deps['fastify'])         stack.add('Fastify');
      if (deps['koa'])             stack.add('Koa');
      if (deps['mongoose'])        stack.add('MongoDB');
      if (deps['pg'] || deps['postgres']) stack.add('PostgreSQL');
      if (deps['mysql2'] || deps['mysql']) stack.add('MySQL');
      if (deps['redis'])           stack.add('Redis');
      if (deps['prisma'] || deps['@prisma/client']) stack.add('Prisma');
      if (deps['typeorm'])         stack.add('TypeORM');
      if (deps['typescript'])      stack.add('TypeScript');
      if (deps['graphql'])         stack.add('GraphQL');
      if (deps['socket.io'])       stack.add('Socket.IO');
      if (deps['tailwindcss'])     stack.add('Tailwind CSS');
      if (deps['vite'])            stack.add('Vite');
      if (deps['webpack'])         stack.add('Webpack');
    } catch {
      // Malformed package.json — continue without it
    }
  }

  if (fs.existsSync(path.join(localPath, 'requirements.txt')) ||
      fs.existsSync(path.join(localPath, 'setup.py')) ||
      fs.existsSync(path.join(localPath, 'pyproject.toml'))) {
    stack.add('Python');
  }
  if (fs.existsSync(path.join(localPath, 'pom.xml'))) stack.add('Java / Maven');
  if (fs.existsSync(path.join(localPath, 'build.gradle'))) stack.add('Java / Gradle');
  if (fs.existsSync(path.join(localPath, 'go.mod'))) stack.add('Go');
  if (fs.existsSync(path.join(localPath, 'Cargo.toml'))) stack.add('Rust');
  if (fs.existsSync(path.join(localPath, 'Gemfile'))) stack.add('Ruby');
  if (fs.existsSync(path.join(localPath, 'composer.json'))) stack.add('PHP');
  if (fs.existsSync(path.join(localPath, 'Dockerfile'))) stack.add('Docker');

  return [...stack];
}

/**
 * Counts total files and groups them by extension.
 */
function countFiles(localPath) {
  const files = walkDir(localPath);
  const byExtension = {};
  for (const f of files) {
    const ext = path.extname(f).toLowerCase() || '(no ext)';
    byExtension[ext] = (byExtension[ext] || 0) + 1;
  }
  return { total: files.length, byExtension };
}

/**
 * Counts total lines of source code across all recognised code files.
 */
function countLOC(localPath) {
  const files = walkDir(localPath).filter(f => CODE_EXTENSIONS.has(path.extname(f).toLowerCase()));
  let totalLines = 0;
  for (const f of files) {
    try {
      const content = fs.readFileSync(f, 'utf-8');
      totalLines += content.split('\n').length;
    } catch {
      // Unreadable file — skip
    }
  }
  return { totalLines, codeFileCount: files.length };
}

/**
 * Runs `npm audit --json` against the cloned repo and parses vulnerability counts.
 * npm audit exits with a non-zero code when vulnerabilities exist, so we always
 * read stdout from either the result or the thrown error object.
 */
function runNpmAudit(localPath) {
  const pkgPath = path.join(localPath, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    return { vulnerabilities: 0, breakdown: {} };
  }

  let rawOutput = '';
  try {
    rawOutput = execSync('npm audit --json', {
      cwd: localPath,
      timeout: 30_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString();
  } catch (err) {
    // npm audit exits non-zero when vulnerabilities are found; stdout still has JSON
    rawOutput = err.stdout?.toString() || '';
  }

  try {
    const audit = JSON.parse(rawOutput);
    const vulns = audit.metadata?.vulnerabilities || {};
    const total =
      (vulns.low || 0) +
      (vulns.moderate || 0) +
      (vulns.high || 0) +
      (vulns.critical || 0);
    return {
      vulnerabilities: total,
      breakdown: {
        low: vulns.low || 0,
        moderate: vulns.moderate || 0,
        high: vulns.high || 0,
        critical: vulns.critical || 0,
      },
    };
  } catch {
    return { vulnerabilities: 0, breakdown: {} };
  }
}

/**
 * Derives a 0–100 complexity score from lines of code, file count, and dependency count.
 * Intentionally kept simple: a rough heuristic, not a formal metric.
 */
function calculateComplexity(totalLines, codeFileCount, depCount) {
  if (codeFileCount === 0) return 0;
  const avgLOC = totalLines / codeFileCount;                   // average file size
  const locScore  = Math.min(40, Math.round((avgLOC  / 200) * 40)); // up to 40 pts
  const depScore  = Math.min(30, Math.round((depCount / 50)  * 30)); // up to 30 pts
  const fileScore = Math.min(30, Math.round((codeFileCount / 200) * 30)); // up to 30 pts
  return locScore + depScore + fileScore;
}

/**
 * Assigns an A-F letter grade based on vulnerability count and complexity.
 */
function gradeFromMetrics(vulnerabilities, complexityScore) {
  if (vulnerabilities === 0 && complexityScore < 30) return 'A';
  if (vulnerabilities <= 2 && complexityScore < 50) return 'B';
  if (vulnerabilities <= 5 && complexityScore < 70) return 'C';
  if (vulnerabilities <= 10)                         return 'D';
  return 'F';
}

/**
 * Main analysis entry point.
 * Now accepts `localPath` (the cloned repo on disk) instead of just a URL,
 * which means all analysis is performed on real files.
 *
 * @param {string} localPath - Absolute path to the shallow-cloned repository.
 * @returns {Promise<object>} Resolved metrics object.
 */
export const performAnalysis = async (localPath) => {
  const techStack                        = detectTechStack(localPath);
  const { total: fileCount, byExtension: filesByExtension } = countFiles(localPath);
  const { totalLines: linesOfCode, codeFileCount }          = countLOC(localPath);
  const { vulnerabilities, breakdown: vulnBreakdown }        = runNpmAudit(localPath);

  // Count declared npm dependencies (deps + devDeps)
  let dependencyCount = 0;
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(localPath, 'package.json'), 'utf-8')
    );
    dependencyCount = Object.keys({
      ...pkg.dependencies,
      ...pkg.devDependencies,
    }).length;
  } catch {
    // No package.json or malformed — leave at 0
  }

  const complexityScore = calculateComplexity(linesOfCode, codeFileCount, dependencyCount);
  const qualityGrade    = gradeFromMetrics(vulnerabilities, complexityScore);

  return {
    techStack,
    fileCount,
    filesByExtension,
    linesOfCode,
    codeFileCount,
    dependencyCount,
    complexityScore,
    vulnerabilities,
    vulnBreakdown,
    qualityGrade,
  };
};
