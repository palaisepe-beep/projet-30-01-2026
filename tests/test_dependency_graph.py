"""Tests for the dependency graph logic.

openpyxl can't *create* external references itself, so the helper below
hand-builds the OOXML parts (externalLinks/*.xml + relationships) that real
Excel writes when a formula points at another workbook. This mirrors the
actual file format instead of mocking it away.
"""
from __future__ import annotations

import re
import zipfile
from pathlib import Path

import openpyxl
import pytest

from excel_toolbox.engine.dependency_graph import (
    build_graph,
    discover_files,
    external_targets,
    topological_order,
)


def _add_external_link(xlsx_path: Path, target_name: str) -> None:
    """Rewrite xlsx_path in place so it contains one external link pointing at
    a sibling file named `target_name` (relative reference, same folder)."""
    data = xlsx_path.read_bytes()
    tmp = xlsx_path.with_suffix(".tmp.xlsx")
    tmp.write_bytes(data)

    zin = zipfile.ZipFile(tmp, "r")

    content_types = zin.read("[Content_Types].xml").decode("utf-8")
    content_types = content_types.replace(
        "</Types>",
        '<Override PartName="/xl/externalLinks/externalLink1.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.externalLink+xml"/>'
        "</Types>",
    )

    wb_rels = zin.read("xl/_rels/workbook.xml.rels").decode("utf-8")
    ids = [int(m) for m in re.findall(r'Id="rId(\d+)"', wb_rels)]
    new_id = max(ids) + 1 if ids else 1
    wb_rels = wb_rels.replace(
        "</Relationships>",
        f'<Relationship Id="rId{new_id}" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink" '
        'Target="externalLinks/externalLink1.xml"/></Relationships>',
    )

    workbook_xml = zin.read("xl/workbook.xml").decode("utf-8")
    ext_ref = f'<externalReferences><externalReference r:id="rId{new_id}"/></externalReferences>'
    workbook_xml = workbook_xml.replace("</sheets>", "</sheets>" + ext_ref)

    ext_link_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<externalLink xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <externalBook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1">
    <sheetNames><sheetName val="Sheet"/></sheetNames>
  </externalBook>
</externalLink>"""

    ext_link_rels = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLinkPath" Target="{target_name}" TargetMode="External"/>
</Relationships>"""

    zout = zipfile.ZipFile(xlsx_path, "w", zipfile.ZIP_DEFLATED)
    for item in zin.infolist():
        payload = zin.read(item.filename)
        if item.filename == "[Content_Types].xml":
            payload = content_types.encode("utf-8")
        elif item.filename == "xl/_rels/workbook.xml.rels":
            payload = wb_rels.encode("utf-8")
        elif item.filename == "xl/workbook.xml":
            payload = workbook_xml.encode("utf-8")
        zout.writestr(item, payload)
    zout.writestr("xl/externalLinks/externalLink1.xml", ext_link_xml)
    zout.writestr("xl/externalLinks/_rels/externalLink1.xml.rels", ext_link_rels)
    zout.close()
    zin.close()
    tmp.unlink()


def _make_workbook(path: Path) -> None:
    wb = openpyxl.Workbook()
    wb.active["A1"] = "placeholder"
    wb.save(path)


@pytest.fixture
def chain_dir(tmp_path: Path) -> Path:
    """C.xlsx <- B.xlsx <- A.xlsx (A depends on B depends on C)."""
    a, b, c = tmp_path / "A.xlsx", tmp_path / "B.xlsx", tmp_path / "C.xlsx"
    _make_workbook(a)
    _make_workbook(b)
    _make_workbook(c)
    _add_external_link(a, "B.xlsx")
    _add_external_link(b, "C.xlsx")
    return tmp_path


def test_discover_files_finds_all_spreadsheets(chain_dir: Path):
    files = discover_files([chain_dir])
    assert {f.name for f in files} == {"A.xlsx", "B.xlsx", "C.xlsx"}


def test_external_targets_resolves_relative_reference(chain_dir: Path):
    targets = external_targets(chain_dir / "A.xlsx")
    assert targets == {(chain_dir / "B.xlsx").resolve()}


def test_topological_order_processes_dependencies_first(chain_dir: Path):
    files = discover_files([chain_dir])
    graph = build_graph(files)
    ordered, cycles = topological_order(graph)

    assert cycles == []
    names = [f.name for f in ordered]
    assert names.index("C.xlsx") < names.index("B.xlsx") < names.index("A.xlsx")


def test_topological_order_reports_cycles():
    a, b = Path("/fake/A.xlsx"), Path("/fake/B.xlsx")
    graph = {a: {b}, b: {a}}
    ordered, cycles = topological_order(graph)
    assert ordered == []
    assert set(cycles) == {a, b}
