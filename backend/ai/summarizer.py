import hashlib
import time
from pathlib import Path

import networkx as nx

from ai.client import get_gemini_model


CACHE_DIR = Path("/tmp/repolens_ai_cache")


def _cache_key(rel_path: str, content: str) -> str:
    digest = hashlib.md5(f"{rel_path}:{content[:500]}".encode("utf-8")).hexdigest()
    return digest


def _fallback(attrs: dict) -> str:
    layer = attrs.get("layer", "module")
    defines = attrs.get("defines", [])
    in_degree = attrs.get("in_degree", 0)
    head = ", ".join(defines[:3]) if defines else "core symbols"
    return f"{layer} module defining {head}. Imported by {in_degree} files."


def _generate_summary(rel_path: str, content: str) -> str:
    model = get_gemini_model()
    if model is None:
        return ""
    prompt = (
        f"File: {rel_path}\n\n```\n{content[:3000]}\n```\n\n"
        "Write 2-3 sentences: what this file does, its role in the architecture, "
        "what to read before it. Plain English, no bullets."
    )
    backoff = [4, 8, 16]
    for idx, wait in enumerate(backoff):
        try:
            response = model.generate_content(prompt)
            return (response.text or "").strip()
        except Exception:  # noqa: BLE001
            if idx == len(backoff) - 1:
                break
            time.sleep(wait)
    return ""


def summarize_files(graph: nx.DiGraph, repo_root: str) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for node_id in graph.nodes:
        abs_path = Path(repo_root) / node_id
        content = abs_path.read_text(encoding="utf-8", errors="ignore")
        key = _cache_key(node_id, content)
        cache_file = CACHE_DIR / f"{key}.txt"
        if cache_file.exists():
            graph.nodes[node_id]["summary"] = cache_file.read_text(encoding="utf-8")
            continue
        summary = _generate_summary(node_id, content)
        if not summary:
            summary = _fallback(graph.nodes[node_id])
        cache_file.write_text(summary, encoding="utf-8")
        graph.nodes[node_id]["summary"] = summary
