from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import connect_db, close_db
from app.routes.repo_routes import router

app = FastAPI(
    title="RepoLens API",
    description="AI-powered repository architecture analyser",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    await connect_db()

@app.on_event("shutdown")
async def shutdown():
    await close_db()

@app.get("/")
async def root():
    return {"message": "RepoLens API is running!"}

app.include_router(router, prefix="/api/repo", tags=["Repository"])