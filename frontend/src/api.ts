import axios from "axios";
import { RepoData, QueryResult } from "./types";

const BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 300000,
});

export const analyzeRepo = async (repoUrl: string): Promise<RepoData> => {
  const response = await api.post("/api/repo/analyze", {
    repo_url: repoUrl,
  });
  return response.data.data;
};

export const queryRepo = async (
  repoId: string,
  query: string,
): Promise<QueryResult> => {
  const response = await api.post("/api/repo/query", {
    repo_id: repoId,
    query,
  });
  return response.data;
};
