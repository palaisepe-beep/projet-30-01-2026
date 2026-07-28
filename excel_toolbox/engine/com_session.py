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
            # DispatchEx forces a brand-new, dedicated Excel instance instead of
            # attaching to one the user already has open. That keeps our
            # automation (manual calc, DisplayAlerts off, Quit at the end)
            # isolated from the user's own Excel windows and files.
            self.app = win32.DispatchEx("Excel.Application")
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
            self._safe_close(wb)

    @staticmethod
    def _safe_close(wb) -> None:
        """Close a workbook without letting a cleanup hiccup abort the batch.

        Marking the workbook as already-saved stops Excel from trying to pop a
        save prompt on close -- a prompt it can't actually show (alerts are
        disabled), which surfaces as "La méthode Close de la classe Workbook a
        échoué". The real save already happened via Save()/SaveAs() before this,
        so there is nothing to lose by forcing the close.
        """
        try:
            wb.Saved = True
        except Exception:
            pass
        for _ in range(2):
            try:
                wb.Close(SaveChanges=False)
                return
            except Exception:
                pass

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
            self._safe_close(wb)

    def unprotect_sheets(self, path: Path, password: str | None) -> int:
        """Remove sheet (and workbook-structure) protection using the password
        the user supplied, then save in place. Returns how many sheets were
        unprotected.

        This is not password cracking: Excel's own Unprotect only succeeds with
        the correct password, exactly as it does in the Excel UI. A wrong
        password makes Excel raise, and we re-raise a clear message naming the
        sheets that could not be unprotected.
        """
        wb = self.app.Workbooks.Open(
            str(path),
            UpdateLinks=XL_UPDATE_LINKS_NEVER,
            ReadOnly=False,
            IgnoreReadOnlyRecommended=True,
            Notify=False,
        )
        failures: list[str] = []
        unprotected = 0
        try:
            for sheet in wb.Sheets:
                try:
                    if not sheet.ProtectContents:
                        continue
                    if password:
                        sheet.Unprotect(Password=password)
                    else:
                        sheet.Unprotect()
                    unprotected += 1
                except Exception:
                    failures.append(str(sheet.Name))
            try:
                if wb.ProtectStructure:
                    wb.Unprotect(Password=password) if password else wb.Unprotect()
            except Exception:
                pass
            wb.Save()
        finally:
            self._safe_close(wb)

        if failures:
            raise RuntimeError(
                "mot de passe incorrect (ou feuille non déprotégeable) pour : "
                + ", ".join(failures)
            )
        return unprotected
