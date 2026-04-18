import { create } from "zustand";
import { RepoData, Node, QueryResult } from "./types";

interface AppStore {
  repoData: RepoData | null;
  selectedNode: Node | null;
  isLoading: boolean;
  error: string | null;
  queryResult: QueryResult | null;
  activeTab: "graph" | "onboarding" | "orphans" | "commits";
  searchTerm: string;
  setRepoData: (data: RepoData) => void;
  setSelectedNode: (node: Node | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setQueryResult: (result: QueryResult | null) => void;
  setActiveTab: (tab: "graph" | "onboarding" | "orphans" | "commits") => void;
  setSearchTerm: (term: string) => void;
  reset: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  repoData: null,
  selectedNode: null,
  isLoading: false,
  error: null,
  queryResult: null,
  activeTab: "graph",
  searchTerm: "",
  setRepoData: (data) => set({ repoData: data }),
  setSelectedNode: (node) => set({ selectedNode: node }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setQueryResult: (result) => set({ queryResult: result }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  reset: () =>
    set({
      repoData: null,
      selectedNode: null,
      error: null,
      queryResult: null,
      activeTab: "graph",
      searchTerm: "",
    }),
}));
