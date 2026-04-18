function classifyNode(inDegree, outDegree, isExternal) {
  if (isExternal) return "external";
  if (inDegree === 0 && outDegree > 0) return "entry";
  if (inDegree >= 3) return "core";
  if (outDegree <= 2) return "utility";
  return "utility";
}

function computeOnboardingPath(nodes) {
  const entries = nodes.filter((n) => n.type === "entry").map((n) => n.id);
  const core = nodes
    .filter((n) => n.type === "core")
    .sort((a, b) => b.riskScore - a.riskScore)
    .map((n) => n.id);
  const remaining = nodes
    .filter((n) => !entries.includes(n.id) && !core.includes(n.id) && n.type !== "external")
    .sort((a, b) => b.inDegree - a.inDegree)
    .map((n) => n.id);

  return [...new Set([...entries, ...core, ...remaining])].slice(0, 15);
}

function buildGraph({ repoUrl, repoName, files, dependencyMap }) {
  const nodes = [];
  const edges = [];
  const inDegreeMap = {};
  const outDegreeMap = {};
  const externalSet = new Set();

  Object.keys(files).forEach((id) => {
    inDegreeMap[id] = 0;
    outDegreeMap[id] = 0;
  });

  Object.entries(dependencyMap).forEach(([source, deps]) => {
    deps.internalImports.forEach((target) => {
      edges.push({ source, target, type: "import" });
      outDegreeMap[source] += 1;
      inDegreeMap[target] = (inDegreeMap[target] || 0) + 1;
    });

    deps.externalImports.forEach((pkg) => {
      const externalId = `external:${pkg}`;
      externalSet.add(pkg);
      edges.push({ source, target: externalId, type: "import" });
      outDegreeMap[source] += 1;
      inDegreeMap[externalId] = (inDegreeMap[externalId] || 0) + 1;
    });
  });

  Object.entries(files).forEach(([id, fileData]) => {
    const inDegree = inDegreeMap[id] || 0;
    const outDegree = outDegreeMap[id] || 0;
    const type = classifyNode(inDegree, outDegree, false);
    const riskScore = inDegree + outDegree;

    nodes.push({
      id,
      label: id.split("/").pop(),
      type,
      inDegree,
      outDegree,
      riskScore,
      isHighRisk: false,
      isOrphan: inDegree === 0 && type !== "entry",
      language: fileData.language,
      summary: "",
      size: fileData.size || Buffer.byteLength(fileData.content || "", "utf8")
    });
  });

  externalSet.forEach((pkg) => {
    const id = `external:${pkg}`;
    nodes.push({
      id,
      label: pkg,
      type: "external",
      inDegree: inDegreeMap[id] || 0,
      outDegree: 0,
      riskScore: inDegreeMap[id] || 0,
      isHighRisk: false,
      isOrphan: false,
      language: "external",
      summary: "External package dependency.",
      size: 0
    });
  });

  const sortedRisk = [...nodes].filter((n) => n.type !== "external").sort((a, b) => b.riskScore - a.riskScore);
  const thresholdIndex = Math.max(0, Math.floor(sortedRisk.length * 0.2) - 1);
  const threshold = sortedRisk[thresholdIndex] ? sortedRisk[thresholdIndex].riskScore : Number.POSITIVE_INFINITY;
  nodes.forEach((node) => {
    if (node.type !== "external") {
      node.isHighRisk = node.riskScore >= threshold;
    }
  });

  const onboardingPath = computeOnboardingPath(nodes);
  const entryPoints = nodes.filter((n) => n.type === "entry").map((n) => n.id);

  return {
    nodes,
    edges,
    metadata: {
      repoUrl,
      repoName,
      totalFiles: Object.keys(files).length,
      entryPoints,
      onboardingPath,
      analyzedAt: new Date().toISOString()
    }
  };
}

module.exports = { buildGraph };
