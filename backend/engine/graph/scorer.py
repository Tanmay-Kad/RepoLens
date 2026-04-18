import networkx as nx


def compute_graph_metrics(graph: nx.DiGraph) -> None:
    if graph.number_of_nodes() == 0:
        return
    pagerank = nx.pagerank(graph) if graph.number_of_edges() > 0 else {}
    max_pr = max(pagerank.values()) if pagerank else 1.0
    if max_pr == 0:
        max_pr = 1.0

    in_degree = dict(graph.in_degree())
    out_degree = dict(graph.out_degree())
    for node in graph.nodes:
        raw_score = pagerank.get(node, 0.0)
        graph.nodes[node]["risk_score"] = round(raw_score / max_pr, 4)
        graph.nodes[node]["in_degree"] = in_degree.get(node, 0)
        graph.nodes[node]["out_degree"] = out_degree.get(node, 0)
        graph.nodes[node]["is_orphan"] = (
            in_degree.get(node, 0) == 0 and out_degree.get(node, 0) == 0
        )
