import os

import networkx as nx

from engine.parsing.base_parser import ParsedFile


def build_dependency_graph(parsed_files: list[ParsedFile]) -> nx.DiGraph:
    graph = nx.DiGraph()
    rel_paths = {item.rel_path for item in parsed_files}
    stem_to_paths: dict[str, str] = {}
    for rel_path in rel_paths:
        stem_to_paths[os.path.splitext(os.path.basename(rel_path))[0]] = rel_path

    for item in parsed_files:
        graph.add_node(
            item.rel_path,
            defines=item.defines,
            calls=item.calls,
            raw_imports=item.raw_imports,
            imports=item.imports,
        )

    for item in parsed_files:
        for module in item.imports:
            target = stem_to_paths.get(module)
            if not target or target == item.rel_path:
                continue
            graph.add_edge(item.rel_path, target, type="import")

    return graph
