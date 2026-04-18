import { useMemo } from "react";
import { useRepoStore } from "../../store/useRepoStore";

export function useOnboarding() {
  const graphData = useRepoStore((state) => state.graphData);
  return useMemo(() => graphData?.onboarding ?? [], [graphData]);
}
