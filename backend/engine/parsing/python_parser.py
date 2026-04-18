import ast

from engine.parsing.base_parser import ParsedFile


class _Visitor(ast.NodeVisitor):
    def __init__(self) -> None:
        self.imports: set[str] = set()
        self.raw_imports: set[str] = set()
        self.calls: set[str] = set()
        self.defines: set[str] = set()

    def visit_Import(self, node: ast.Import) -> None:  # noqa: N802
        for alias in node.names:
            module = alias.name.split(".")[0]
            self.imports.add(module)
            self.raw_imports.add(alias.name)
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:  # noqa: N802
        if node.module:
            module = node.module.split(".")[0]
            self.imports.add(module)
            self.raw_imports.add(node.module)
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call) -> None:  # noqa: N802
        if isinstance(node.func, ast.Name):
            self.calls.add(node.func.id)
        elif isinstance(node.func, ast.Attribute):
            self.calls.add(node.func.attr)
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> None:  # noqa: N802
        self.defines.add(node.name)
        self.generic_visit(node)

    def visit_ClassDef(self, node: ast.ClassDef) -> None:  # noqa: N802
        self.defines.add(node.name)
        self.generic_visit(node)


def parse_python_file(rel_path: str, content: str) -> ParsedFile:
    try:
        tree = ast.parse(content)
    except SyntaxError:
        return ParsedFile(rel_path, [], [], [], [])
    visitor = _Visitor()
    visitor.visit(tree)
    return ParsedFile(
        rel_path=rel_path,
        imports=sorted(visitor.imports),
        calls=sorted(visitor.calls),
        defines=sorted(visitor.defines),
        raw_imports=sorted(visitor.raw_imports),
    )
