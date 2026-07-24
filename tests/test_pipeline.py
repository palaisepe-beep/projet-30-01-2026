"""Tests the orchestration logic (ordering, events, error isolation) with a
fake Excel session, since the real one needs Windows + Excel installed."""
from __future__ import annotations

from pathlib import Path

import openpyxl
import pytest

from excel_toolbox.engine import pipeline
from tests.test_dependency_graph import _add_external_link, _make_workbook


class FakeExcelSession:
    """Records calls instead of touching real Excel; can simulate a failure
    on a chosen file to verify the batch keeps going."""

    instances = []

    def __init__(self, fail_on: str | None = None):
        self.calls: list[tuple[str, Path]] = []
        self.fail_on = fail_on
        FakeExcelSession.instances.append(self)

    def __call__(self, *args, **kwargs):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def refresh_links(self, path: Path) -> None:
        if self.fail_on and path.name == self.fail_on:
            raise RuntimeError("boom")
        self.calls.append(("refresh_links", path))

    def flatten_to_values(self, src: Path, dst: Path) -> None:
        self.calls.append(("flatten_to_values", src))


@pytest.fixture
def chain_dir(tmp_path: Path) -> Path:
    a, b, c = tmp_path / "A.xlsx", tmp_path / "B.xlsx", tmp_path / "C.xlsx"
    _make_workbook(a)
    _make_workbook(b)
    _make_workbook(c)
    _add_external_link(a, "B.xlsx")
    _add_external_link(b, "C.xlsx")
    return tmp_path


def test_run_batch_processes_in_dependency_order_and_backs_up(monkeypatch, chain_dir, tmp_path):
    fake = FakeExcelSession()
    monkeypatch.setattr(pipeline, "ExcelSession", lambda *a, **k: fake)

    events = []
    pipeline.run_batch(
        [chain_dir], "refresh_links", tmp_path / ".backup", events.append
    )

    processed_names = [path.name for _, path in fake.calls]
    assert processed_names.index("C.xlsx") < processed_names.index("B.xlsx") < processed_names.index("A.xlsx")

    finished = [e for e in events if e.kind == "finished"]
    assert len(finished) == 1
    assert any(e.kind == "file_done" and e.file.name == "C.xlsx" for e in events)

    backups = list((tmp_path / ".backup").rglob("*.xlsx"))
    assert {p.name for p in backups} == {"A.xlsx", "B.xlsx", "C.xlsx"}


def test_run_batch_continues_after_one_file_fails(monkeypatch, chain_dir, tmp_path):
    fake = FakeExcelSession(fail_on="B.xlsx")
    monkeypatch.setattr(pipeline, "ExcelSession", lambda *a, **k: fake)

    events = []
    pipeline.run_batch(
        [chain_dir], "refresh_links", tmp_path / ".backup", events.append
    )

    errors = [e for e in events if e.kind == "file_error"]
    assert len(errors) == 1
    assert errors[0].file.name == "B.xlsx"

    done_names = {e.file.name for e in events if e.kind == "file_done"}
    assert done_names == {"A.xlsx", "C.xlsx"}
