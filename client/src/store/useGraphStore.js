import { create } from "zustand";

const useGraphStore = create((set) => ({
  graph: null,
  repoId: null,
  selectedNode: null,
  highlightedNodes: [],
  isLoading: false,
  loadingStep: "",
  error: null,
  setGraph: (graph, repoId) => set({ graph, repoId, selectedNode: null, highlightedNodes: [] }),
  setSelectedNode: (selectedNode) => set({ selectedNode }),
  setHighlightedNodes: (highlightedNodes) => set({ highlightedNodes }),
  setLoading: (isLoading, loadingStep = "") => set({ isLoading, loadingStep }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      graph: null,
      repoId: null,
      selectedNode: null,
      highlightedNodes: [],
      isLoading: false,
      loadingStep: "",
      error: null
    })
}));

export default useGraphStore;
