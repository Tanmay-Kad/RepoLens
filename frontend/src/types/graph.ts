export interface GraphNode {
  id: string;
  label: string;
  layer:
    | "entry"
    | "service"
    | "model"
    | "api"
    | "util"
    | "config"
    | "test"
    | "worker"
    | "ai"
    | "module";
  risk_score: number;
  in_degree: number;
  out_degree: number;
  defines: string[];
  calls: string[];
  is_orphan: boolean;
  summary: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: "import";
}

export interface OnboardingItem {
  order: number;
  file: string;
  layer: GraphNode["layer"];
  risk_score: number;
  summary: string;
}

export interface GraphResultPayload {
  repo_id: string;
  repo_url: string;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  onboarding: OnboardingItem[];
  architecture: string;
  stats: { total_files: number; total_edges: number; orphans: number };
}
