const express = require("express");
const RepoGraph = require("../models/RepoGraph");

const router = express.Router();

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
