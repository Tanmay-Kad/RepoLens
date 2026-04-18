import os
import re
from app.config import NODE_TYPES

def get_all_files(repo_path: str) -> list:
    supported_extensions = [".py", ".js", ".ts", ".jsx", ".tsx"]
    files = []

    for root, dirs, filenames in os.walk(repo_path):
        dirs[:] = [d for d in dirs if d not in [
            ".git", "node_modules", "__pycache__",
            ".venv", "venv", "dist", "build", ".next"
        ]]
        for filename in filenames:
            if any(filename.endswith(ext) for ext in supported_extensions):
                full_path = os.path.join(root, filename)
                relative_path = os.path.relpath(full_path, repo_path)
                files.append({
                    "full_path": full_path,
                    "relative_path": relative_path.replace("\\", "/"),
                    "filename": filename,
                    "extension": os.path.splitext(filename)[1]
                })

    return files

def extract_imports(file_path: str, extension: str) -> list:
    imports = []
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()

        if extension == ".py":
            patterns = [
                r"^import\s+([\w.]+)",
                r"^from\s+([\w.]+)\s+import",
            ]
            for pattern in patterns:
                matches = re.findall(pattern, content, re.MULTILINE)
                imports.extend(matches)

        elif extension in [".js", ".ts", ".jsx", ".tsx"]:
            patterns = [
                r'import\s+.*?\s+from\s+["\']([^"\']+)["\']',
                r'require\s*\(\s*["\']([^"\']+)["\']\s*\)',
            ]
            for pattern in patterns:
                matches = re.findall(pattern, content)
                imports.extend(matches)

    except Exception as e:
        print(f"Error reading {file_path}: {e}")

    return list(set(imports))

def classify_node(filename: str, relative_path: str, imports: list) -> str:
    name_lower = filename.lower()
    path_lower = relative_path.lower()

    if name_lower in NODE_TYPES["entry"]:
        return "entry"

    if name_lower in NODE_TYPES["config"]:
        return "config"

    for util_keyword in NODE_TYPES["utility"]:
        if util_keyword in path_lower:
            return "utility"

    for ext_lib in NODE_TYPES["external"]:
        if any(ext_lib in imp.lower() for imp in imports):
            return "external"

    return "business"

def read_file_content(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        return content[:3000]
    except:
        return ""

def detect_orphan_files(files: list, edges: list) -> list:
    files_with_connections = set()
    for edge in edges:
        files_with_connections.add(edge["source"])
        files_with_connections.add(edge["target"])

    orphans = []
    for file in files:
        path = file["relative_path"]
        if path not in files_with_connections:
            if file["node_type"] not in ["entry", "config"]:
                orphans.append(path)

    return orphans