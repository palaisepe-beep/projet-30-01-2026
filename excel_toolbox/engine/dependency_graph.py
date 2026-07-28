"""Discover Excel files and figure out which ones depend on which others.

A workbook "depends on" another workbook if it has an external reference
(a formula like ='[Source.xlsx]Sheet1'!A1) pointing at it. When refreshing a
batch of interdependent files we must process the files being pointed *to*
before the files that point *at* them, otherwise a refresh reads stale data.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import unquote, urlparse

import openpyxl

SUPPORTED_EXTENSIONS = {".xlsx", ".xlsm"}


def discover_files(paths) -> list[Path]:
    """Expand a mix of files and folders into a sorted list of unique, absolute
    spreadsheet file paths. Folders are scanned recursively."""
    found: set[Path] = set()
    for raw in paths:
        p = Path(raw)
        if p.is_dir():
            for ext in SUPPORTED_EXTENSIONS:
                found.update(p.rglob(f"*{ext}"))
        elif p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS:
            found.add(p)
    return sorted(f.resolve() for f in found)


def _resolve_target(target: str | None, base_dir: Path) -> Path | None:
    if not target:
        return None
    if target.startswith("file:///"):
        path_part = unquote(urlparse(target).path)
        # file:///C:/foo.xlsx -> urlparse gives "/C:/foo.xlsx" on Windows-style paths
        if len(path_part) > 2 and path_part[0] == "/" and path_part[2] == ":":
            path_part = path_part[1:]
        return Path(path_part)
    candidate = base_dir / unquote(target)
    try:
        return candidate.resolve()
    except OSError:
        return candidate


def external_targets(xlsx_path: Path) -> set[Path]:
    """Return the absolute paths this workbook has external references to.
    Targets that don't exist on disk are still returned (caller decides what to
    do with them); this only inspects the file, it never opens Excel."""
    try:
        wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=False)
    except Exception:
        return set()

    base_dir = Path(xlsx_path).resolve().parent
    targets: set[Path] = set()
    for link in getattr(wb, "_external_links", []):
        rel = getattr(link, "file_link", None)
        target = getattr(rel, "Target", None) if rel is not None else None
        resolved = _resolve_target(target, base_dir)
        if resolved is not None:
            targets.add(resolved)
    wb.close()
    return targets


def has_external_links(xlsx_path: Path) -> bool | None:
    """Whether this workbook references any other workbook at all.

    Returns True/False when it can be determined, or None when the file could
    not be read -- callers must treat None as "don't know, process it anyway"
    so a file is never skipped just because openpyxl failed to parse it.
    """
    try:
        wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=False)
    except Exception:
        return None
    try:
        for link in getattr(wb, "_external_links", []):
            rel = getattr(link, "file_link", None)
            if rel is not None and getattr(rel, "Target", None):
                return True
        return False
    finally:
        wb.close()


def build_graph(files: list[Path]) -> dict[Path, set[Path]]:
    """Return {file: {other files in `files` that it depends on}}."""
    files_set = set(files)
    return {f: {d for d in external_targets(f) if d in files_set} for f in files}


def topological_order(graph: dict[Path, set[Path]]) -> tuple[list[Path], list[Path]]:
    """Kahn's algorithm. Returns (ordered_files, files_stuck_in_a_cycle).

    Files with no dependencies among the selected set come first, files that
    depend on them come after, etc. Files caught in a circular reference are
    reported separately instead of silently dropped or crashing.
    """
    in_degree = {node: len(deps) for node, deps in graph.items()}
    dependents: dict[Path, set[Path]] = {node: set() for node in graph}
    for node, deps in graph.items():
        for dep in deps:
            dependents.setdefault(dep, set()).add(node)

    ready = sorted((n for n, d in in_degree.items() if d == 0), key=str)
    ordered: list[Path] = []
    while ready:
        node = ready.pop(0)
        ordered.append(node)
        for dependent in sorted(dependents.get(node, ()), key=str):
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                ready.append(dependent)

    cycle_nodes = [n for n in graph if n not in ordered]
    return ordered, cycle_nodes
