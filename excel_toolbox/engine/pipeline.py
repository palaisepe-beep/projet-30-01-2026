"""Ties scanning, ordering, backup and the Excel engine together.

Designed to be called from a background thread: every step reports through a
`on_event` callback instead of printing, so a GUI can render live progress.
Errors on one file are caught and reported, they don't abort the whole batch
-- one broken workbook in a folder of fifty shouldn't stop the other 49.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable, Iterable, Literal

from .backup import backup_file
from .com_session import ExcelSession, ExcelUnavailableError
from .dependency_graph import (
    build_graph,
    discover_files,
    has_external_links,
    topological_order,
)

EventKind = Literal[
    "plan", "start_file", "file_done", "file_error", "file_skip",
    "cycle_warning", "finished",
]


@dataclass
class Event:
    kind: EventKind
    file: Path | None = None
    message: str = ""
    index: int = 0
    total: int = 0


Action = Literal["refresh_links", "flatten_to_values"]


def plan_batch(paths: Iterable[Path]) -> tuple[list[Path], list[Path]]:
    """Discover files under the given files/folders and order them so that a
    file is only processed after everything it depends on."""
    files = discover_files(paths)
    graph = build_graph(files)
    ordered, cycles = topological_order(graph)
    return ordered, cycles


def run_batch(
    paths: Iterable[Path],
    action: Action,
    backup_root: Path,
    on_event: Callable[[Event], None],
    make_backup: bool = True,
) -> None:
    ordered, cycles = plan_batch(paths)

    if cycles:
        ordered = ordered + cycles

    # In refresh mode, a file with no external links has nothing to update, so
    # opening and re-saving it is wasted time. Skip those up front. Files we
    # can't read (has_external_links -> None) are kept, never skipped.
    skipped: list[Path] = []
    if action == "refresh_links":
        kept: list[Path] = []
        for f in ordered:
            if has_external_links(f) is False:
                skipped.append(f)
            else:
                kept.append(f)
        ordered = kept

    total = len(ordered)
    on_event(Event(kind="plan", total=total, message=f"{total} fichier(s) à traiter"))

    if cycles:
        names = ", ".join(p.name for p in cycles)
        on_event(Event(
            kind="cycle_warning",
            message=f"Référence circulaire détectée entre : {names} (ordre non garanti pour ces fichiers)",
        ))

    for f in skipped:
        on_event(Event(kind="file_skip", file=f,
                       message="aucune liaison externe"))

    run_timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")

    try:
        with ExcelSession() as excel:
            for index, file in enumerate(ordered, start=1):
                on_event(Event(kind="start_file", file=file, index=index, total=total))
                try:
                    if make_backup:
                        backup_file(file, backup_root, run_timestamp)
                    if action == "refresh_links":
                        excel.refresh_links(file)
                    elif action == "flatten_to_values":
                        dst = file.with_name(f"{file.stem}_independant{file.suffix}")
                        excel.flatten_to_values(file, dst)
                    on_event(Event(kind="file_done", file=file, index=index, total=total))
                except Exception as exc:
                    on_event(Event(
                        kind="file_error", file=file, index=index, total=total, message=str(exc)
                    ))
    except ExcelUnavailableError as exc:
        on_event(Event(kind="finished", message=str(exc)))
        return

    on_event(Event(kind="finished", message="Terminé"))
