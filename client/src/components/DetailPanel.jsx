import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { summarizeNode } from "../api";
import useGraphStore from "../store/useGraphStore";

function Badge({ children }) {
  return <span className="rounded-full border border-border px-2 py-1 text-xs text-muted">{children}</span>;
}

export default function DetailPanel() {
  const { graph, selectedNode, repoId, setGraph } = useGraphStore();
  const [isSummarizing, setIsSummarizing] = useState(false);

  const node = useMemo(() => graph?.nodes.find((n) => n.id === selectedNode), [graph, selectedNode]);
  if (!node || !graph) return null;

  const imports = graph.edges.filter((e) => e.source === node.id).map((e) => e.target);
  const importedBy = graph.edges.filter((e) => e.target === node.id).map((e) => e.source);

  const triggerSummary = async () => {
    setIsSummarizing(true);
    summarizeNode(
      repoId,
      node.id,
      (data) => {
        if (!data?.chunk) return;
        const nextGraph = {
          ...graph,
          nodes: graph.nodes.map((n) => (n.id === node.id ? { ...n, summary: data.chunk } : n))
        };
        setGraph(nextGraph, repoId);
        if (data.done) setIsSummarizing(false);
      },
      () => {
        toast.error("Summary unavailable");
        setIsSummarizing(false);
      }
    );
  };

  return (
    <div className="space-y-4 p-4 text-sm text-text">
      <div>
        <h3 className="text-lg font-bold">{node.label}</h3>
        <p className="text-xs text-muted">{node.id}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge>{node.type}</Badge>
        <Badge>{node.language}</Badge>
        <Badge>Risk: {node.riskScore}</Badge>
      </div>
      {node.isHighRisk && <p className="rounded-md bg-red-900/30 p-2 text-red-300">High risk — changes here affect many files.</p>}
      {node.isOrphan && <p className="rounded-md bg-yellow-900/20 p-2 text-yellow-300">Orphan module — nothing imports this.</p>}

      <div>
        <h4 className="mb-1 font-medium">Imports</h4>
        <ul className="space-y-1 text-muted">
          {imports.length ? imports.map((item) => <li key={item}>{item}</li>) : <li>None</li>}
        </ul>
      </div>
      <div>
        <h4 className="mb-1 font-medium">Imported by</h4>
        <ul className="space-y-1 text-muted">
          {importedBy.length ? importedBy.map((item) => <li key={item}>{item}</li>) : <li>None</li>}
        </ul>
      </div>

      <div>
        <h4 className="mb-1 font-medium">AI Summary</h4>
        {node.summary ? (
          <p className="rounded-md bg-bg p-2 text-muted">{node.summary}</p>
        ) : (
          <button
            disabled={isSummarizing}
            onClick={triggerSummary}
            className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {isSummarizing ? "Generating..." : "Click to generate"}
          </button>
        )}
      </div>
    </div>
  );
}
