"""Entry point for Excel Toolbox. This is also what PyInstaller packages
into the distributed .exe (see build.py)."""
from excel_toolbox.gui.app import run_gui

if __name__ == "__main__":
    run_gui()
