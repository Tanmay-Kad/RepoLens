import os

import networkx as nx


def graph_to_json(graph: nx.DiGraph) -> tuple[list[dict], list[dict]]:
    nodes: list[dict] = []
    edges: list[dict] = []
    for node_id, attrs in graph.nodes(data=True):
        nodes.append(
            {
                "id": node_id,
                "label": os.path.basename(node_id),
                "layer": attrs.get("layer", "module"),
                "risk_score": float(attrs.get("risk_score", 0.0)),
                "in_degree": int(attrs.get("in_degree", 0)),
                "out_degree": int(attrs.get("out_degree", 0)),
                "defines": list(attrs.get("defines", [])),
                "calls": list(attrs.get("calls", [])),
                "is_orphan": bool(attrs.get("is_orphan", False)),
                "summary": attrs.get("summary", ""),
            }
        )
    for source, target, attrs in graph.edges(data=True):
        edges.append({"source": source, "target": target, "type": attrs.get("type", "import")})
    return nodes, edges
