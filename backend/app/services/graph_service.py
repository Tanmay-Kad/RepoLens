import networkx as nx
from app.services.parser_service import (
    get_all_files, extract_imports,
    classify_node, detect_orphan_files
)

def build_graph(repo_path: str) -> dict:
    files = get_all_files(repo_path)
    file_map = {}
    for f in files:
        file_map[f["relative_path"]] = f
        name_without_ext = f["filename"].rsplit(".", 1)[0]
        file_map[name_without_ext] = f

    G = nx.DiGraph()
    nodes = []
    edges = []

    file_imports = {}
    for file in files:
        imports = extract_imports(
            file["full_path"],
            file["extension"]
        )
        node_type = classify_node(
            file["filename"],
            file["relative_path"],
            imports
        )
        file["node_type"] = node_type
        file["imports"] = imports
        file_imports[file["relative_path"]] = imports
        G.add_node(file["relative_path"], **file)

    for file in files:
        for imp in file["imports"]:
            imp_clean = imp.replace(".", "/")
            matched = None
            for key in file_map:
                if imp_clean in key or imp in key:
                    matched = file_map[key]
                    break
            if matched and matched["relative_path"] != file["relative_path"]:
                G.add_edge(file["relative_path"], matched["relative_path"])
                edges.append({
                    "source": file["relative_path"],
                    "target": matched["relative_path"]
                })

    degree_centrality = nx.degree_centrality(G)
    in_degree = dict(G.in_degree())

    for file in files:
        path = file["relative_path"]
        file["impact_score"] = round(
            degree_centrality.get(path, 0) * 100, 2
        )
        file["in_degree"] = in_degree.get(path, 0)
        nodes.append({
            "id": path,
            "label": file["filename"],
            "node_type": file["node_type"],
            "impact_score": file["impact_score"],
            "in_degree": file["in_degree"],
            "imports": file["imports"],
            "full_path": file["full_path"]
        })

    orphans = detect_orphan_files(files, edges)

    onboarding_path = generate_onboarding_path(G, files)

    return {
        "nodes": nodes,
        "edges": edges,
        "orphan_files": orphans,
        "onboarding_path": onboarding_path,
        "total_files": len(files),
        "total_edges": len(edges)
    }

def generate_onboarding_path(G: nx.DiGraph, files: list) -> list:
    try:
        topo_order = list(nx.topological_sort(G))
        path = []
        for node in topo_order[:15]:
            path.append(node)
        return path
    except nx.NetworkXUnfeasible:
        sorted_files = sorted(
            files,
            key=lambda x: x.get("impact_score", 0),
            reverse=True
        )
        return [f["relative_path"] for f in sorted_files[:15]]