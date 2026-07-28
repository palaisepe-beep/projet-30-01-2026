"""Drives a single, shared Excel instance in the background via COM.

Only runs on Windows with Excel installed. One Application object is reused
for every file in a batch instead of launching Excel per file -- Excel's own
startup cost (~1-2s) is the biggest fixed overhead in this whole pipeline, so
paying it once for a batch of 50 files instead of 50 times is where most of
the speed comes from.

Uses late-bound `win32com.client.Dispatch` (not `gencache.EnsureDispatch`) and
hard-codes the handful of Excel constants it needs as plain integers. This
avoids depending on win32com's generated type-library cache, which is a
common source of "it works from source but breaks once packaged into a
PyInstaller .exe" failures.
"""
from __future__ import annotations

from pathlib import Path

try:
    import pythoncom
    import win32com.client as win32
except ImportError:  # pragma: no cover - only available on Windows
    pythoncom = None
    win32 = None

# Excel constants (Microsoft Excel Object Library) -- hard-coded to avoid
# needing the generated type library at runtime.
XL_CALCULATION_MANUAL = -4135
XL_CALCULATION_AUTOMATIC = -4105
XL_LINK_TYPE_EXCEL_LINKS = 1
XL_UPDATE_LINKS_ALWAYS = 3
XL_UPDATE_LINKS_NEVER = 0


class ExcelUnavailableError(RuntimeError):
    """Raised when Excel/COM automation isn't available on this machine."""


class ExcelSession:
    """Context manager wrapping one background Excel.Application instance.

    Usage:
        with ExcelSession() as excel:
            excel.refresh_links(path)
            excel.flatten_to_values(src, dst)
    """

    def __init__(self, visible: bool = False):
        if win32 is None:
            raise ExcelUnavailableError(
                "pywin32 n'est pas disponible : cette fonctionnalité nécessite "
                "Windows avec Excel installé."
            )
        self._visible = visible
        self.app = None
        self._keepalive = None

    def __enter__(self) -> "ExcelSession":
        pythoncom.CoInitialize()
        try:
            self.app = win32.Dispatch("Excel.Application")
        except Exception as exc:
            pythoncom.CoUninitialize()
            raise ExcelUnavailableError(
                "Impossible de démarrer Excel. Vérifie qu'Excel est bien "
                "installé sur ce poste."
            ) from exc
        self.app.Visible = self._visible
        self.app.DisplayAlerts = False
        self.app.AskToUpdateLinks = False
        self.app.EnableEvents = False
        self.app.ScreenUpdating = False
        # Excel refuses to set Application.Calculation while no workbook is
        # open ("Impossible de définir la propriété Calculation"). Keep one
        # blank workbook open for the whole session so manual calc is valid
        # throughout -- this also stops each real file from auto-recalculating
        # on open, which is what we want (we recalc explicitly instead).
        self._keepalive = self.app.Workbooks.Add()
        try:
            self.app.Calculation = XL_CALCULATION_MANUAL
        except Exception:
            pass
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        try:
            if self.app is not None:
                try:
                    if self._keepalive is not None:
                        self._keepalive.Close(SaveChanges=False)
                except Exception:
                    pass
                self.app.Quit()
        finally:
            self.app = None
            self._keepalive = None
            pythoncom.CoUninitialize()

    def refresh_links(self, path: Path) -> None:
        """Open a workbook, force it to pull the latest values from every
        external workbook it references, recalculate, and save in place."""
        wb = self.app.Workbooks.Open(
            str(path),
            UpdateLinks=XL_UPDATE_LINKS_ALWAYS,
            ReadOnly=False,
            IgnoreReadOnlyRecommended=True,
            Notify=False,
        )
        try:
            # CalculateFull recomputes every formula with the freshly updated
            # link values, but WITHOUT rebuilding the dependency tree from
            # scratch (which CalculateFullRebuild does). Since we only refresh
            # values and never edit formulas, the tree is unchanged -- this is
            # both correct and far faster.
            self.app.CalculateFull()
        except Exception:
            self.app.Calculate()
        try:
            self.app.CalculateUntilAsyncQueriesDone()
        except Exception:
            pass  # not available on every Excel version
        try:
            wb.Save()
        finally:
            wb.Close(SaveChanges=True)

    def flatten_to_values(self, src_path: Path, dst_path: Path) -> None:
        """Open a workbook and save a copy where every formula (including
        ones pointing at other workbooks) has been replaced by its last
        computed value. The result is fully self-contained."""
        wb = self.app.Workbooks.Open(
            str(src_path),
            UpdateLinks=XL_UPDATE_LINKS_NEVER,
            ReadOnly=True,
            IgnoreReadOnlyRecommended=True,
            Notify=False,
        )
        try:
            for sheet in wb.Sheets:
                used = sheet.UsedRange
                used.Value = used.Value  # formulas -> their last computed value

            try:
                link_sources = wb.LinkSources(XL_LINK_TYPE_EXCEL_LINKS)
            except Exception:
                link_sources = None
            for link in link_sources or []:
                try:
                    wb.BreakLink(Name=link, Type=XL_LINK_TYPE_EXCEL_LINKS)
                except Exception:
                    pass

            wb.SaveAs(str(dst_path))
        finally:
            wb.Close(SaveChanges=False)
