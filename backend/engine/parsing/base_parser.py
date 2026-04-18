from dataclasses import dataclass


@dataclass
class ParsedFile:
    rel_path: str
    imports: list[str]
    calls: list[str]
    defines: list[str]
    raw_imports: list[str]
