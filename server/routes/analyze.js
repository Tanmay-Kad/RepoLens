const express = require("express");
const RepoGraph = require("../models/RepoGraph");
const { fetchRepositoryFiles } = require("../services/github");
const { parseRepository } = require("../services/parser");
const { buildGraph } = require("../services/graphBuilder");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { repoUrl } = req.body || {};
    if (!repoUrl) {
      const err = new Error("repoUrl is required");
      err.status = 400;
      throw err;
    }

    const existing = await RepoGraph.findOne({
      repoUrl,
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    }).lean();

    if (existing) {
      return res.json({
        repoId: existing._id,
        graph: existing.graph
      });
    }

    const { repoName, files } = await fetchRepositoryFiles(repoUrl);
    const dependencyMap = parseRepository(files);
    const graph = buildGraph({ repoUrl, repoName, files, dependencyMap });

    const fileContents = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.content]));
    const doc = await RepoGraph.create({
      repoUrl,
      repoName,
      graph,
      fileContents
    });

    return res.status(201).json({
      repoId: doc._id,
      graph
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:repoId", async (req, res, next) => {
  try {
    const doc = await RepoGraph.findById(req.params.repoId).lean();
    if (!doc) {
      const err = new Error("Repository graph not found");
      err.status = 404;
      throw err;
    }
    res.json({ repoId: doc._id, graph: doc.graph });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
