from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.github_service import (
    clone_repository, get_commit_history, cleanup_repository
)
from app.services.graph_service import build_graph
from app.services.ai_service import (
    generate_file_summary, generate_onboarding_explanation, answer_nl_query
)
from app.database import get_db
import re

router = APIRouter()

class RepoRequest(BaseModel):
    repo_url: str

class QueryRequest(BaseModel):
    repo_id: str
    query: str

def extract_repo_name(url: str) -> str:
    match = re.search(r"github\.com/([^/]+)/([^/]+)", url)
    if match:
        return f"{match.group(1)}_{match.group(2)}"
    return "unknown_repo"

@router.post("/analyze")
async def analyze_repository(request: RepoRequest):
    try:
        db = get_db()
        repo_url = request.repo_url.rstrip("/").replace(".git", "")
        repo_name = extract_repo_name(repo_url)

        existing = await db.repositories.find_one({"repo_name": repo_name})
        if existing:
            existing["_id"] = str(existing["_id"])
            return {"status": "cached", "data": existing}

        repo_path = clone_repository(repo_url, repo_name)
        graph_data = build_graph(repo_path)
        commit_history = get_commit_history(repo_path)

        nodes_with_summaries = []
        for node in graph_data["nodes"]:
            summary = await generate_file_summary(
                node["full_path"],
                node["label"],
                node["node_type"]
            )
            node["summary"] = summary
            nodes_with_summaries.append(node)

        onboarding_explanation = await generate_onboarding_explanation(
            graph_data["onboarding_path"]
        )

        result = {
            "repo_name": repo_name,
            "repo_url": repo_url,
            "nodes": nodes_with_summaries,
            "edges": graph_data["edges"],
            "orphan_files": graph_data["orphan_files"],
            "onboarding_path": graph_data["onboarding_path"],
            "onboarding_explanation": onboarding_explanation,
            "commit_history": commit_history,
            "total_files": graph_data["total_files"],
            "total_edges": graph_data["total_edges"]
        }

        await db.repositories.insert_one(result.copy())
        cleanup_repository(repo_path)

        return {"status": "success", "data": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/query")
async def natural_language_query(request: QueryRequest):
    try:
        db = get_db()
        repo = await db.repositories.find_one(
            {"repo_name": request.repo_id}
        )
        if not repo:
            raise HTTPException(status_code=404, detail="Repo not found")

        result = await answer_nl_query(request.query, repo["nodes"])
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/repos")
async def get_all_repos():
    try:
        db = get_db()
        repos = await db.repositories.find(
            {}, {"repo_name": 1, "repo_url": 1,
                 "total_files": 1, "total_edges": 1}
        ).to_list(50)
        for r in repos:
            r["_id"] = str(r["_id"])
        return repos
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))