import mongoose from 'mongoose';

const repositorySchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'analyzing', 'completed', 'failed'],
    default: 'pending',
  },
  cloneStatus: {
    type: String,
    enum: ['pending', 'cloning', 'completed', 'failed'],
    default: 'pending',
  },
  localPath: {
    type: String,
  },
  graphData: {
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    circular: { type: Array, default: [] },
  },
  metrics: {
    type: Object,
    default: {},
  },
  // Keyed by file path, stores cached Gemini AI summaries per node
  aiSummaries: {
    type: Map,
    of: String,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Repository = mongoose.model('Repository', repositorySchema);

export default Repository;
