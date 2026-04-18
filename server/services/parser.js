const path = require("path");

let jsParser = null;
let pyParser = null;
try {
  // Optional dependency mode: if native tree-sitter is unavailable on host, regex fallback is used.
  const Parser = require("tree-sitter");
  const JavaScript = require("tree-sitter-javascript");
  const Python = require("tree-sitter-python");
  jsParser = new Parser();
  jsParser.setLanguage(JavaScript);
  pyParser = new Parser();
  pyParser.setLanguage(Python);
} catch (_error) {
  jsParser = null;
  pyParser = null;
}

const JS_IMPORT_RE = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
const JS_REQUIRE_RE = /require\s*\(\s*['"](.+?)['"]\s*\)/g;
const PY_IMPORT_RE = /^import\s+(\S+)/gm;
const PY_FROM_IMPORT_RE = /^from\s+(\S+)\s+import/gm;

function walkTree(node, visitor) {
  visitor(node);
  for (let i = 0; i < node.childCount; i += 1) {
    walkTree(node.child(i), visitor);
  }
}

function textForNode(content, node) {
  return content.slice(node.startIndex, node.endIndex);
}

function extractJSWithTreeSitter(content) {
  if (!jsParser) {
    throw new Error("tree-sitter unavailable");
  }
  const imports = [];
  const tree = jsParser.parse(content);
  walkTree(tree.rootNode, (node) => {
    if (node.type === "import_statement") {
      const text = textForNode(content, node);
      const match = text.match(/from\s+['"](.+?)['"]/);
      if (match) imports.push(match[1]);
    }
    if (node.type === "call_expression") {
      const text = textForNode(content, node);
      const match = text.match(/^require\s*\(\s*['"](.+?)['"]\s*\)$/);
      if (match) imports.push(match[1]);
    }
  });
  return imports;
}

function extractPyWithTreeSitter(content) {
  if (!pyParser) {
    throw new Error("tree-sitter unavailable");
  }
  const imports = [];
  const tree = pyParser.parse(content);
  walkTree(tree.rootNode, (node) => {
    if (node.type === "import_statement" || node.type === "import_from_statement") {
      const text = textForNode(content, node);
      const fromMatch = text.match(/^from\s+([^\s]+)\s+import/m);
      const importMatch = text.match(/^import\s+([^\s,]+)/m);
      if (fromMatch) imports.push(fromMatch[1]);
      if (importMatch) imports.push(importMatch[1]);
    }
  });
  return imports;
}

function extractWithRegex(content, language) {
  const imports = [];
  if (language === "python") {
    for (const re of [PY_IMPORT_RE, PY_FROM_IMPORT_RE]) {
      re.lastIndex = 0;
      let match = re.exec(content);
      while (match) {
        imports.push(match[1]);
        match = re.exec(content);
      }
    }
    return imports;
  }

  for (const re of [JS_IMPORT_RE, JS_REQUIRE_RE]) {
    re.lastIndex = 0;
    let match = re.exec(content);
    while (match) {
      imports.push(match[1]);
      match = re.exec(content);
    }
  }
  return imports;
}

function resolveRelativeImport(filePath, specifier, repoFilesSet) {
  const normalized = filePath.replace(/\\/g, "/");
  const baseDir = normalized.includes("/") ? normalized.slice(0, normalized.lastIndexOf("/")) : "";
  const candidates = [];
  const raw = path.posix.normalize(path.posix.join(baseDir, specifier));

  candidates.push(raw);
  [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py"].forEach((ext) => candidates.push(`${raw}${ext}`));
  candidates.push(path.posix.join(raw, "index.js"));
  candidates.push(path.posix.join(raw, "index.ts"));
  candidates.push(path.posix.join(raw, "__init__.py"));

  return candidates.find((candidate) => repoFilesSet.has(candidate)) || null;
}

function parseFileImports(filePath, fileData, repoFilesSet) {
  const { content, language } = fileData;
  let imports = [];
  try {
    imports = language === "python" ? extractPyWithTreeSitter(content) : extractJSWithTreeSitter(content);
  } catch (_error) {
    imports = extractWithRegex(content, language);
  }

  const internalImports = [];
  const externalImports = [];

  imports.forEach((item) => {
    if (!item) return;
    if (item.startsWith(".") || item.startsWith("/")) {
      const resolved = resolveRelativeImport(filePath, item, repoFilesSet);
      if (resolved) internalImports.push(resolved);
      return;
    }
    externalImports.push(item);
  });

  return { internalImports, externalImports };
}

function parseRepository(files) {
  const repoFilesSet = new Set(Object.keys(files));
  const dependencyMap = {};

  for (const [filePath, fileData] of Object.entries(files)) {
    dependencyMap[filePath] = parseFileImports(filePath, fileData, repoFilesSet);
  }

  return dependencyMap;
}

module.exports = { parseRepository };
