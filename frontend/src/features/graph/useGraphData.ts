import { useEffect } from "react";
import { getResult, getStatus } from "../../api/repos";
import { useRepoStore } from "../../store/useRepoStore";

export function useGraphData(): void {
  const { jobId, status, setStatus, setGraphData } = useRepoStore();

  useEffect(() => {
    if (!jobId || status === "completed" || status === "failed") {
      return;
    }
    const timer = setInterval(async () => {
      const current = await getStatus(jobId);
      setStatus(current.status, current.progress, current.stage);
      if (current.status === "completed") {
        const payload = await getResult(jobId);
        setGraphData(payload);
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [jobId, status, setStatus, setGraphData]);
}
