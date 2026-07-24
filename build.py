"""Builds the single-file Windows executable with PyInstaller.

Run on Windows, inside a venv with requirements-dev.txt installed:
    python build.py

Produces dist/ExcelToolbox.exe -- that one file is what gets shared with the
team, no Python or install step needed on their machines (Excel itself still
has to be installed, since the tool drives it in the background).
"""
import subprocess
import sys

ARGS = [
    sys.executable, "-m", "PyInstaller",
    "main.py",
    "--name", "ExcelToolbox",
    "--onefile",
    "--windowed",
    "--noconfirm",
    # customtkinter and tkinterdnd2 both ship non-.py assets (themes, tkdnd
    # binaries) that PyInstaller's import scanner won't find on its own.
    "--collect-all", "customtkinter",
    "--collect-all", "tkinterdnd2",
    # pywin32's COM plumbing needs this even when nothing imports it directly.
    "--hidden-import", "win32timezone",
]

if __name__ == "__main__":
    subprocess.run(ARGS, check=True)
