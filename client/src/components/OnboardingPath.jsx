import useGraphStore from "../store/useGraphStore";

function TypeBadge({ type }) {
  return <span className="rounded border border-border px-2 py-0.5 text-[11px] text-muted">{type}</span>;
}

export default function OnboardingPath() {
  const { graph, setSelectedNode } = useGraphStore();
  if (!graph) return null;

  const pathNodes = graph.metadata.onboardingPath
    .map((id) => graph.nodes.find((n) => n.id === id))
    .filter(Boolean);

  return (
    <div className="p-4 text-text">
      <h3 className="text-base font-semibold">Recommended reading order for new developers</h3>
      <ol className="mt-3 space-y-2">
        {pathNodes.map((node, index) => (
          <li key={node.id}>
            <button
              onClick={() => setSelectedNode(node.id)}
              className="w-full rounded-md border border-border bg-bg p-3 text-left transition hover:border-primary"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {index + 1}. {node.label}
                </span>
                <TypeBadge type={node.type} />
              </div>
              <p className="mt-1 text-xs text-muted">{node.id}</p>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
