import { useRepoStore } from "../store/useRepoStore";

export default function NodeDetailPanel() {
  const { graphData, selectedNodeId } = useRepoStore();
  const node = graphData?.graph.nodes.find((item) => item.id === selectedNodeId) ?? null;
  if (!node) {
    return (
      <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 text-xs text-slate-400">
        Select a node in the Cyclone graph to inspect architecture details.
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 text-xs text-slate-200">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">{node.label}</div>
        <span className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-2 py-1 text-[11px] text-cyan-200">
          {node.layer}
        </span>
      </div>
      <div className="text-slate-400">{node.id}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-slate-800/80 p-2">
          <p className="text-[10px] uppercase text-slate-400">Risk</p>
          <p className="text-sm font-semibold text-rose-300">{node.risk_score.toFixed(3)}</p>
        </div>
        <div className="rounded-xl bg-slate-800/80 p-2">
          <p className="text-[10px] uppercase text-slate-400">In</p>
          <p className="text-sm font-semibold">{node.in_degree}</p>
        </div>
        <div className="rounded-xl bg-slate-800/80 p-2">
          <p className="text-[10px] uppercase text-slate-400">Out</p>
          <p className="text-sm font-semibold">{node.out_degree}</p>
        </div>
      </div>
      <p className="leading-relaxed text-slate-300">{node.summary}</p>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Defines</p>
        <p className="text-slate-300">{node.defines.length > 0 ? node.defines.join(", ") : "No symbols detected."}</p>
      </div>
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Calls</p>
        <p className="text-slate-300">{node.calls.length > 0 ? node.calls.slice(0, 12).join(", ") : "No calls detected."}</p>
      </div>
    </div>
  );
}
