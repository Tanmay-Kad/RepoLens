import axios from "axios";
import type { GraphResultPayload } from "../types/graph";

const api = axios.create({ baseURL: "http://localhost:8000" });

export async function analyzeRepo(url: string): Promise<{ job_id: string }> {
  const { data } = await api.post("/api/repos/analyze", { url });
  return data;
}

export async function getStatus(
  jobId: string,
): Promise<{ job_id: string; status: string; progress: number; stage: string }> {
  const { data } = await api.get(`/api/repos/status/${jobId}`);
  return data;
}

export async function getResult(jobId: string): Promise<GraphResultPayload> {
  const { data } = await api.get(`/api/repos/result/${jobId}`);
  return data;
}
