import json
import time

from ai.client import get_gemini_model


def generate_architecture_narrative(nodes: list[dict], edges: list[dict]) -> str:
    model = get_gemini_model()
    if model is None:
        return "RepoLens could not generate an AI architecture narrative because Gemini is not configured."
    payload = {
        "top_nodes": sorted(nodes, key=lambda n: n["risk_score"], reverse=True)[:10],
        "edge_count": len(edges),
    }
    prompt = (
        "Write one concise paragraph explaining this repository architecture, "
        "major module interactions, and likely risk hotspots.\n"
        f"{json.dumps(payload)[:8000]}"
    )
    for idx, wait in enumerate([4, 8, 16]):
        try:
            response = model.generate_content(prompt)
            text = (response.text or "").strip()
            if text:
                return text
        except Exception:  # noqa: BLE001
            if idx < 2:
                time.sleep(wait)
    return "Architecture narrative unavailable; graph data is still ready for exploration."
