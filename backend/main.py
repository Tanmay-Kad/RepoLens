from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.query import router as query_router
from api.repos import router as repos_router


app = FastAPI(title="RepoLens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(repos_router, prefix="/api/repos", tags=["repos"])
app.include_router(query_router, prefix="/api/query", tags=["query"])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
