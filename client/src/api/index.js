import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: API_BASE
});

export async function analyzeRepo(repoUrl) {
  const { data } = await api.post("/api/analyze", { repoUrl });
  return data;
}

export function summarizeNode(repoId, nodeId, onMessage, onError) {
  const url = `${API_BASE}/api/query/summarize`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repoId, nodeId })
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error("Failed to summarize");
      }
      const text = await res.text();
      const chunks = text
        .split("\n")
        .filter((line) => line.startsWith("data: "))
        .map((line) => JSON.parse(line.replace("data: ", "")));
      chunks.forEach((chunk) => onMessage(chunk));
    })
    .catch((err) => onError(err));
}

export async function searchNodes(repoId, query) {
  const { data } = await api.post("/api/query/search", { repoId, query });
  return data;
}

export async function getGraph(repoId) {
  const { data } = await api.get(`/api/graph/${repoId}`);
  return data;
}
