from pathlib import PurePosixPath

import networkx as nx


def _classify(path: str) -> str:
    lower = path.lower()
    name = PurePosixPath(lower).name
    if "test" in lower:
        return "test"
    if "/api/" in lower or name.startswith("api"):
        return "api"
    if "/worker" in lower or "task" in name:
        return "worker"
    if "/model" in lower or "schema" in name:
        return "model"
    if "/service" in lower:
        return "service"
    if "/config" in lower or name in {"settings.py", "config.py"}:
        return "config"
    if "/ai/" in lower or "llm" in lower or "gemini" in lower:
        return "ai"
    if "/util" in lower or "/common" in lower:
        return "util"
    if name in {"main.py", "app.py", "index.ts", "main.tsx"}:
        return "entry"
    return "module"


def classify_layers(graph: nx.DiGraph) -> None:
    for node in graph.nodes:
        graph.nodes[node]["layer"] = _classify(node)
