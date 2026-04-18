const express = require("express");
const RepoGraph = require("../models/RepoGraph");
const { summarizeFile, searchRelevantFiles } = require("../services/claude");

const router = express.Router();

function setSSEHeaders(res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
}

router.post("/summarize", async (req, res, next) => {
  try {
    const { repoId, nodeId } = req.body || {};
    if (!repoId || !nodeId) {
      const err = new Error("repoId and nodeId are required");
      err.status = 400;
      throw err;
    }

    const doc = await RepoGraph.findById(repoId);
    if (!doc) {
      const err = new Error("Repository graph not found");
      err.status = 404;
      throw err;
    }

    const node = doc.graph.nodes.find((n) => n.id === nodeId);
    if (!node) {
      const err = new Error("Node not found");
      err.status = 404;
      throw err;
    }

    setSSEHeaders(res);

    if (node.summary) {
      res.write(`data: ${JSON.stringify({ chunk: node.summary, done: true })}\n\n`);
      res.end();
      return;
    }

    const fileContent = doc.fileContents.get(nodeId) || "";
    let summary = "Summary unavailable";
    try {
      summary = await summarizeFile({ filename: nodeId, fileContent });
    } catch (_error) {
      summary = "Summary unavailable";
    }

    node.summary = summary;
    await doc.save();

    res.write(`data: ${JSON.stringify({ chunk: summary, done: true })}\n\n`);
    res.end();
  } catch (error) {
    next(error);
  }
});

router.post("/search", async (req, res, next) => {
  try {
    const { repoId, query } = req.body || {};
    if (!repoId || !query) {
      const err = new Error("repoId and query are required");
      err.status = 400;
      throw err;
    }

    const doc = await RepoGraph.findById(repoId).lean();
    if (!doc) {
      const err = new Error("Repository graph not found");
      err.status = 404;
      throw err;
    }

    const fileList = doc.graph.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      summary: n.summary || "",
      inDegree: n.inDegree,
      outDegree: n.outDegree
    }));

    let matchedNodes = await searchRelevantFiles({ query, fileList });
    if (!matchedNodes.length) {
      const q = query.toLowerCase();
      matchedNodes = doc.graph.nodes
        .filter((n) => n.id.toLowerCase().includes(q) || n.label.toLowerCase().includes(q) || (n.summary || "").toLowerCase().includes(q))
        .slice(0, 10)
        .map((n) => n.id);
    }

    res.json({ matchedNodes });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
