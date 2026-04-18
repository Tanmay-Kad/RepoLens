import threading
import time
import uuid
from dataclasses import dataclass, field
from typing import Any

from ai.narrator import generate_architecture_narrative
from ai.nl_router import build_tfidf_index
from ai.summarizer import summarize_files
from config import get_settings
from engine.graph.builder import build_dependency_graph
from engine.graph.classifier import classify_layers
from engine.graph.scorer import compute_graph_metrics
from engine.graph.serializer import graph_to_json
from engine.ingestion.cloner import clone_or_update_repo
from engine.ingestion.walker import walk_source_files
from engine.onboarding.planner import build_onboarding_plan
from engine.parsing.dispatcher import parse_all


@dataclass
class JobState:
    id: str
    repo_url: str
    status: str = "queued"
    progress: int = 0
    stage: str = "Queued"
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: float = field(default_factory=time.time)


_JOBS: dict[str, JobState] = {}
_LOCK = threading.Lock()


def submit_analysis(repo_url: str) -> str:
    job_id = str(uuid.uuid4())
    job = JobState(id=job_id, repo_url=repo_url)
    with _LOCK:
        _JOBS[job_id] = job
    thread = threading.Thread(target=_run, args=(job_id,), daemon=True)
    thread.start()
    return job_id


def get_job(job_id: str) -> JobState | None:
    with _LOCK:
        return _JOBS.get(job_id)


def _set_stage(job: JobState, progress: int, stage: str) -> None:
    job.progress = progress
    job.stage = stage


def _run(job_id: str) -> None:
    job = get_job(job_id)
    if not job:
        return

    settings = get_settings()
    job.status = "running"
    try:
        _set_stage(job, 5, "Cloning repository")
        repo_id, local_repo_path = clone_or_update_repo(
            repo_url=job.repo_url,
            clone_base_dir=settings.temp_clone_dir,
            github_token=settings.github_token,
        )

        _set_stage(job, 15, "Walking file tree")
        files = walk_source_files(
            root_path=local_repo_path,
            max_file_size_kb=settings.max_file_size_kb,
            max_files=settings.max_files_per_repo,
        )

        _set_stage(job, 25, f"Parsing {len(files)} files")
        parsed_files = parse_all(files)

        _set_stage(job, 45, "Building dependency graph")
        graph = build_dependency_graph(parsed_files)
        classify_layers(graph)
        compute_graph_metrics(graph)

        _set_stage(job, 55, "Generating AI summaries (Gemini)")
        summarize_files(graph, local_repo_path)

        _set_stage(job, 75, "Computing onboarding path + TF-IDF index")
        onboarding = build_onboarding_plan(graph)
        nodes, edges = graph_to_json(graph)
        index_bundle = build_tfidf_index(nodes)

        _set_stage(job, 88, "Generating architecture narrative")
        architecture = generate_architecture_narrative(nodes, edges)

        stats = {
            "total_files": len(nodes),
            "total_edges": len(edges),
            "orphans": sum(1 for node in nodes if node["is_orphan"]),
        }

        job.result = {
            "repo_id": repo_id,
            "repo_url": job.repo_url,
            "graph": {"nodes": nodes, "edges": edges},
            "onboarding": onboarding,
            "architecture": architecture,
            "stats": stats,
            "_tfidf": index_bundle,
        }
        job.status = "completed"
        _set_stage(job, 100, "Complete")
    except Exception as exc:  # noqa: BLE001
        job.status = "failed"
        job.error = str(exc)
