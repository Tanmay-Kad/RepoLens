from pydantic import BaseModel
from fastapi import APIRouter, HTTPException

from ai.nl_router import query_nodes
from workers.analyze_task import get_job


router = APIRouter()


class QueryRequest(BaseModel):
    job_id: str
    query: str


@router.post("/")
def query_graph(payload: QueryRequest) -> dict[str, list[str]]:
    job = get_job(payload.job_id)
    if not job or not job.result:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(status_code=409, detail="Job not complete")
    tfidf_bundle = job.result.get("_tfidf")
    if not tfidf_bundle:
        return {"node_ids": []}
    nodes = job.result["graph"]["nodes"]
    node_ids = query_nodes(payload.query, nodes, tfidf_bundle)
    return {"node_ids": node_ids}
