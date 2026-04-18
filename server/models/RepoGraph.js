const mongoose = require("mongoose");

const RepoGraphSchema = new mongoose.Schema({
  repoUrl: { type: String, required: true },
  repoName: String,
  graph: {
    nodes: [mongoose.Schema.Types.Mixed],
    edges: [mongoose.Schema.Types.Mixed],
    metadata: mongoose.Schema.Types.Mixed
  },
  fileContents: { type: Map, of: String },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
});

RepoGraphSchema.index({ repoUrl: 1 });
RepoGraphSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RepoGraph", RepoGraphSchema);
