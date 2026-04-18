import re

from engine.parsing.base_parser import ParsedFile


IMPORT_RE = re.compile(r"import\s+.*?from\s+['\"](.*?)['\"]")
REQUIRE_RE = re.compile(r"require\(['\"](.*?)['\"]\)")
DEFINE_RE = re.compile(r"(?:function|class)\s+([A-Za-z_][A-Za-z0-9_]*)")
CALL_RE = re.compile(r"([A-Za-z_][A-Za-z0-9_]*)\s*\(")


def _to_module_name(raw: str) -> str:
    cleaned = raw.replace("./", "").replace("../", "").split("/")[0]
    return cleaned.split(".")[0]


def parse_js_file(rel_path: str, content: str) -> ParsedFile:
    raw_imports = IMPORT_RE.findall(content) + REQUIRE_RE.findall(content)
    imports = sorted({_to_module_name(val) for val in raw_imports if val})
    defines = sorted(set(DEFINE_RE.findall(content)))
    calls = sorted(set(CALL_RE.findall(content)))
    return ParsedFile(
        rel_path=rel_path,
        imports=imports,
        calls=calls,
        defines=defines,
        raw_imports=sorted(set(raw_imports)),
    )
