import { nlQuery } from "../../api/query";
import { useRepoStore } from "../../store/useRepoStore";

export function useNLQuery(): { runQuery: (query: string) => Promise<void> } {
  const { jobId, setMatchedNodeIds } = useRepoStore();

  async function runQuery(query: string): Promise<void> {
    if (!jobId || !query.trim()) {
      setMatchedNodeIds([]);
      return;
    }
    const response = await nlQuery(jobId, query.trim());
    setMatchedNodeIds(response.node_ids);
  }

  return { runQuery };
}
