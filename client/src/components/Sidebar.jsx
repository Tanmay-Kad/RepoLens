import SearchBar from "./SearchBar";
import DetailPanel from "./DetailPanel";
import OnboardingPath from "./OnboardingPath";
import useGraphStore from "../store/useGraphStore";

export default function Sidebar() {
  const { graph, selectedNode } = useGraphStore();

  if (!graph) return null;
  const highRiskCount = graph.nodes.filter((n) => n.isHighRisk).length;
  const orphanCount = graph.nodes.filter((n) => n.isOrphan).length;

  return (
    <aside className="flex h-full w-[380px] flex-col border-l border-border bg-surface">
      <SearchBar />
      <div className="flex-1 overflow-y-auto">{selectedNode ? <DetailPanel /> : <OnboardingPath />}</div>
      <div className="border-t border-border p-4 text-xs text-muted">
        <p>Total files: {graph.metadata.totalFiles}</p>
        <p>Entry points: {graph.metadata.entryPoints.length}</p>
        <p>High-risk files: {highRiskCount}</p>
        <p>Orphans: {orphanCount}</p>
      </div>
    </aside>
  );
}
