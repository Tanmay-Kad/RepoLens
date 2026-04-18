from pydantic import BaseModel, HttpUrl
from fastapi import APIRouter, HTTPException

from workers.analyze_task import get_job, submit_analysis


router = APIRouter()


class AnalyzeRequest(BaseModel):
    url: HttpUrl


@router.post("/analyze")
def analyze_repo(payload: AnalyzeRequest) -> dict[str, str]:
    job_id = submit_analysis(str(payload.url))
    return {"job_id": job_id}


@router.get("/status/{job_id}")
def get_status(job_id: str) -> dict[str, str | int]:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return {
        "job_id": job.id,
        "status": job.status,
        "progress": job.progress,
        "stage": job.stage,
    }


@router.get("/result/{job_id}")
def get_result(job_id: str) -> dict:
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status == "failed":
        raise HTTPException(status_code=500, detail=job.error or "Analysis failed")
    if job.status != "completed" or not job.result:
        raise HTTPException(status_code=409, detail="Result not ready")
    result = {**job.result}
    result.pop("_tfidf", None)
    return result
