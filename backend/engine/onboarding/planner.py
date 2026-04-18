import networkx as nx


def build_onboarding_plan(graph: nx.DiGraph) -> list[dict]:
    entries = [n for n, d in graph.nodes(data=True) if d.get("layer") == "entry"]
    if not entries:
        entries = sorted(graph.nodes, key=lambda n: graph.nodes[n].get("risk_score", 0), reverse=True)[:3]

    visited: set[str] = set()
    ordered: list[str] = []
    for entry in entries:
        for node in nx.bfs_tree(graph, entry):
            if node not in visited:
                visited.add(node)
                ordered.append(node)

    for node in sorted(
        graph.nodes, key=lambda n: graph.nodes[n].get("risk_score", 0), reverse=True
    ):
        if node not in visited:
            ordered.append(node)

    plan: list[dict] = []
    for idx, node in enumerate(ordered, start=1):
        attrs = graph.nodes[node]
        plan.append(
            {
                "order": idx,
                "file": node,
                "layer": attrs.get("layer", "module"),
                "risk_score": attrs.get("risk_score", 0.0),
                "summary": attrs.get("summary", ""),
            }
        )
    return plan
