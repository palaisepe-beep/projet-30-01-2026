from pathlib import Path

from excel_toolbox.engine.backup import backup_file


def test_backup_file_preserves_content_and_structure(tmp_path: Path):
    source_dir = tmp_path / "data" / "reports"
    source_dir.mkdir(parents=True)
    original = source_dir / "Report.xlsx"
    original.write_bytes(b"fake xlsx bytes")

    backup_root = tmp_path / ".backup"
    dest = backup_file(original, backup_root, run_timestamp="2026-07-24_120000")

    assert dest.exists()
    assert dest.read_bytes() == b"fake xlsx bytes"
    assert dest.parent.name == "reports"
    assert "2026-07-24_120000" in dest.parts


def test_backup_file_avoids_name_collisions_across_folders(tmp_path: Path):
    dir_a = tmp_path / "A"
    dir_b = tmp_path / "B"
    dir_a.mkdir()
    dir_b.mkdir()
    (dir_a / "Same.xlsx").write_bytes(b"a")
    (dir_b / "Same.xlsx").write_bytes(b"b")

    backup_root = tmp_path / ".backup"
    dest_a = backup_file(dir_a / "Same.xlsx", backup_root, run_timestamp="run1")
    dest_b = backup_file(dir_b / "Same.xlsx", backup_root, run_timestamp="run1")

    assert dest_a != dest_b
    assert dest_a.read_bytes() == b"a"
    assert dest_b.read_bytes() == b"b"
