import axios from "axios";

const api = axios.create({ baseURL: "http://localhost:8000" });

export async function nlQuery(jobId: string, query: string): Promise<{ node_ids: string[] }> {
  const { data } = await api.post("/api/query/", { job_id: jobId, query });
  return data;
}
