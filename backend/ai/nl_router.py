import json
import time
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ai.client import get_gemini_model


def build_tfidf_index(nodes: list[dict[str, Any]]) -> dict[str, Any]:
    corpus = [
        f"{n['id']} {n['layer']} {n['summary']} {' '.join(n['defines'])}" for n in nodes
    ]
    vectorizer = TfidfVectorizer(ngram_range=(1, 2))
    matrix = vectorizer.fit_transform(corpus) if corpus else None
    return {"vectorizer": vectorizer, "matrix": matrix}


def _gemini_fallback(query: str, nodes: list[dict[str, Any]]) -> list[str]:
    model = get_gemini_model()
    if model is None:
        return []
    compact = [{"id": n["id"], "summary": n["summary"]} for n in nodes]
    prompt = (
        "Return only a JSON array of matching node ids for this query.\n"
        f"Query: {query}\n"
        f"Nodes: {json.dumps(compact)[:12000]}"
    )
    for idx, wait in enumerate([4, 8, 16]):
        try:
            text = (model.generate_content(prompt).text or "").strip()
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
        except Exception:  # noqa: BLE001
            if idx < 2:
                time.sleep(wait)
    return []


def query_nodes(query: str, nodes: list[dict[str, Any]], tfidf_bundle: dict[str, Any]) -> list[str]:
    if not nodes:
        return []
    vectorizer = tfidf_bundle["vectorizer"]
    matrix = tfidf_bundle["matrix"]
    if matrix is None:
        return []

    q_vec = vectorizer.transform([query])
    scores = cosine_similarity(q_vec, matrix).flatten()
    top_indices = scores.argsort()[-8:][::-1]
    node_ids = [nodes[idx]["id"] for idx in top_indices if scores[idx] > 0.1]
    if node_ids:
        return node_ids
    return _gemini_fallback(query, nodes)
