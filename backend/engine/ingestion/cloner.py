import hashlib
from pathlib import Path

from git import Repo


def _repo_id(repo_url: str) -> str:
    return hashlib.md5(repo_url.encode("utf-8")).hexdigest()[:12]


def _url_with_token(repo_url: str, token: str) -> str:
    if not token or "github.com" not in repo_url or "@" in repo_url:
        return repo_url
    return repo_url.replace("https://", f"https://{token}@")


def clone_or_update_repo(
    repo_url: str, clone_base_dir: str, github_token: str = ""
) -> tuple[str, str]:
    repo_id = _repo_id(repo_url)
    clone_path = Path(clone_base_dir) / repo_id
    clone_path.parent.mkdir(parents=True, exist_ok=True)
    auth_url = _url_with_token(repo_url, github_token)
    if clone_path.exists():
        repo = Repo(str(clone_path))
        repo.remotes.origin.pull()
    else:
        Repo.clone_from(auth_url, str(clone_path))
    return repo_id, str(clone_path)
