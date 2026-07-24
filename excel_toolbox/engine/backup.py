"""Safety net: copy a file into a timestamped backup folder before it gets
overwritten in place."""
from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path


def backup_file(path: Path, backup_root: Path, run_timestamp: str | None = None) -> Path:
    """Copy `path` under backup_root/<run_timestamp>/<original file name>,
    preserving folder structure relative to the file's own drive/root so files
    with the same name in different folders don't collide. Returns the backup
    destination path."""
    run_timestamp = run_timestamp or datetime.now().strftime("%Y-%m-%d_%H%M%S")
    path = Path(path).resolve()
    # anchor + parts without the drive/root marker gives a clean relative tree
    relative = Path(*path.parts[1:]) if path.is_absolute() else path
    dest = Path(backup_root) / run_timestamp / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)
    return dest
