import os


IGNORE_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    "venv",
    "__pycache__",
    "dist",
    "build",
    ".next",
}
SUPPORTED_EXTENSIONS = {".py", ".js", ".jsx", ".ts", ".tsx"}


def walk_source_files(
    root_path: str, max_file_size_kb: int, max_files: int
) -> list[dict[str, str]]:
    items: list[dict[str, str]] = []
    max_bytes = max_file_size_kb * 1024
    for root, dirs, files in os.walk(root_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]
        for name in files:
            if len(items) >= max_files:
                return items
            ext = os.path.splitext(name)[1].lower()
            if ext not in SUPPORTED_EXTENSIONS:
                continue
            full_path = os.path.join(root, name)
            if os.path.getsize(full_path) > max_bytes:
                continue
            rel_path = os.path.relpath(full_path, root_path).replace("\\", "/")
            items.append({"rel_path": rel_path, "full_path": full_path})
    return items
