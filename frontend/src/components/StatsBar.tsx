import { useRepoStore } from "../store/useRepoStore";
import type { GraphNode } from "../types/graph";

export default function StatsBar() {
  const stats = useRepoStore((state) => state.graphData?.stats);
  const topRisk = useRepoStore((state) =>
    state.graphData?.graph.nodes
      .slice()
      .sort((a: GraphNode, b: GraphNode) => b.risk_score - a.risk_score)
      .slice(0, 3)
      .map((node: GraphNode) => node.label)
      .join(", "),
  );
  if (!stats) {
    return null;
  }
  return (
    <div className="grid grid-cols-4 gap-3 text-sm">
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-3 text-slate-200">
        <p className="text-xs text-slate-400">Total Files</p>
        <p className="text-xl font-semibold">{stats.total_files}</p>
      </div>
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-3 text-slate-200">
        <p className="text-xs text-slate-400">Dependencies</p>
        <p className="text-xl font-semibold">{stats.total_edges}</p>
      </div>
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-3 text-slate-200">
        <p className="text-xs text-slate-400">Orphan Modules</p>
        <p className="text-xl font-semibold">{stats.orphans}</p>
      </div>
      <div className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-3 text-slate-200">
        <p className="text-xs text-slate-400">Top Risk Files</p>
        <p className="line-clamp-2 text-sm font-medium">{topRisk || "n/a"}</p>
      </div>
    </div>
  );
}
