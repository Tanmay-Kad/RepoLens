from pathlib import Path

from engine.parsing.base_parser import ParsedFile
from engine.parsing.js_parser import parse_js_file
from engine.parsing.python_parser import parse_python_file


def parse_one(file_item: dict[str, str]) -> ParsedFile:
    rel_path = file_item["rel_path"]
    full_path = file_item["full_path"]
    suffix = Path(rel_path).suffix.lower()
    with open(full_path, encoding="utf-8", errors="ignore") as file_obj:
        content = file_obj.read()
    if suffix == ".py":
        return parse_python_file(rel_path, content)
    if suffix in {".js", ".jsx", ".ts", ".tsx"}:
        return parse_js_file(rel_path, content)
    return ParsedFile(rel_path=rel_path, imports=[], calls=[], defines=[], raw_imports=[])


def parse_all(files: list[dict[str, str]]) -> list[ParsedFile]:
    return [parse_one(item) for item in files]
