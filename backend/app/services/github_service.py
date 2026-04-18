import os
import stat
import shutil
import git
from app.config import GITHUB_TOKEN, TEMP_REPO_PATH

def handle_remove_readonly(func, path, exc_info):
    os.chmod(path, stat.S_IWRITE)
    func(path)

def clone_repository(repo_url: str, repo_name: str) -> str:
    os.makedirs(TEMP_REPO_PATH, exist_ok=True)
    repo_path = os.path.join(TEMP_REPO_PATH, repo_name)

    if os.path.exists(repo_path):
        shutil.rmtree(repo_path, onexc=handle_remove_readonly)

    print(f"Cloning {repo_url}...")

    if GITHUB_TOKEN:
        if "https://" in repo_url:
            repo_url = repo_url.replace(
                "https://",
                f"https://{GITHUB_TOKEN}@"
            )

    git.Repo.clone_from(repo_url, repo_path)
    print(f"Cloned to {repo_path}")
    return repo_path

def get_commit_history(repo_path: str) -> list:
    try:
        repo = git.Repo(repo_path)
        commits = []
        for commit in list(repo.iter_commits())[:50]:
            commits.append({
                "hash": commit.hexsha[:7],
                "message": commit.message.strip(),
                "author": commit.author.name,
                "date": commit.committed_datetime.isoformat(),
                "files_changed": list(commit.stats.files.keys())
            })
        return commits
    except Exception as e:
        print(f"Error getting commit history: {e}")
        return []

def cleanup_repository(repo_path: str):
    try:
        if os.path.exists(repo_path):
            shutil.rmtree(repo_path, onexc=handle_remove_readonly)
            print(f"Cleaned up {repo_path}")
    except Exception as e:
        print(f"Cleanup warning: {e}")