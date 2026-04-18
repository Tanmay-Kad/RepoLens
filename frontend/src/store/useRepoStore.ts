import { create } from "zustand";
import type { GraphResultPayload } from "../types/graph";

interface RepoState {
  jobId: string | null;
  status: string;
  progress: number;
  stage: string;
  graphData: GraphResultPayload | null;
  matchedNodeIds: string[];
  selectedNodeId: string | null;
  setJob: (jobId: string) => void;
  setStatus: (status: string, progress: number, stage: string) => void;
  setGraphData: (payload: GraphResultPayload) => void;
  setMatchedNodeIds: (nodeIds: string[]) => void;
  setSelectedNodeId: (nodeId: string | null) => void;
}

export const useRepoStore = create<RepoState>((set) => ({
  jobId: null,
  status: "idle",
  progress: 0,
  stage: "Idle",
  graphData: null,
  matchedNodeIds: [],
  selectedNodeId: null,
  setJob: (jobId) => set({ jobId, status: "queued", progress: 0, stage: "Queued" }),
  setStatus: (status, progress, stage) => set({ status, progress, stage }),
  setGraphData: (graphData) =>
    set((state) => ({
      graphData,
      selectedNodeId:
        state.selectedNodeId &&
        graphData.graph.nodes.some((node) => node.id === state.selectedNodeId)
          ? state.selectedNodeId
          : graphData.graph.nodes[0]?.id ?? null,
    })),
  setMatchedNodeIds: (matchedNodeIds) => set({ matchedNodeIds }),
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
}));
