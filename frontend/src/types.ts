export interface Node {
  id: string;
  label: string;
  node_type: 'entry' | 'business' | 'utility' | 'external' | 'config';
  impact_score: number;
  in_degree: number;
  imports: string[];
  summary: string;
}

export interface Edge {
  source: string;
  target: string;
}

export interface RepoData {
  repo_name: string;
  repo_url: string;
  nodes: Node[];
  edges: Edge[];
  orphan_files: string[];
  onboarding_path: string[];
  onboarding_explanation: string;
  commit_history: CommitHistory[];
  total_files: number;
  total_edges: number;
}

export interface CommitHistory {
  hash: string;
  message: string;
  author: string;
  date: string;
  files_changed: string[];
}

export interface QueryResult {
  answer: string;
  relevant_files: string[];
}