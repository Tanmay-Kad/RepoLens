import URLInput from "./components/URLInput";
import ProgressBar from "./components/ProgressBar";
import StatsBar from "./components/StatsBar";
import NodeDetailPanel from "./components/NodeDetailPanel";
import CycloneGraph from "./features/graph/CycloneGraph";
import { useGraphData } from "./features/graph/useGraphData";
import NLQueryBar from "./features/query/NLQueryBar";
import OnboardingPanel from "./features/onboarding/OnboardingPanel";
import { useOnboarding } from "./features/onboarding/useOnboarding";
import { useRepoStore } from "./store/useRepoStore";

export default function App() {
  useGraphData();
  const { graphData, matchedNodeIds, selectedNodeId, setSelectedNodeId } = useRepoStore();
  const onboarding = useOnboarding();

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-4">
      <header className="rounded-2xl border border-slate-700/50 bg-slate-900/70 p-5 shadow-2xl shadow-slate-950/50">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-300">Developer Productivity Platform</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">RepoLens Architecture Intelligence</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-400">
          Analyze repository topology, inspect dependency risk, and navigate a guided onboarding map using our Cyclone graph visualization.
        </p>
      </header>
      <URLInput />
      <ProgressBar />
      <NLQueryBar />
      <StatsBar />
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-8">
          <CycloneGraph
            nodes={graphData?.graph.nodes ?? []}
            edges={graphData?.graph.edges ?? []}
            matchedNodeIds={matchedNodeIds}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
          />
        </div>
        <div className="col-span-4 space-y-3">
          <NodeDetailPanel />
          <OnboardingPanel items={onboarding} />
        </div>
      </div>
      </div>
    </main>
  );
}
