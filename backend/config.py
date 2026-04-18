from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    github_token: str = Field(default="", alias="GITHUB_TOKEN")
    temp_clone_dir: str = Field(default="/tmp/repolens_repos", alias="TEMP_CLONE_DIR")
    database_url: str = Field(
        default="sqlite+aiosqlite:///./repolens.db", alias="DATABASE_URL"
    )
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    max_file_size_kb: int = Field(default=100, alias="MAX_FILE_SIZE_KB")
    max_files_per_repo: int = Field(default=500, alias="MAX_FILES_PER_REPO")

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
