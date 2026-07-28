"""
================================================================================
  EXCEL TOOLBOX - VERSION "UN SEUL FICHIER" POUR SPYDER
================================================================================

  Cette version tient dans UN seul fichier et n'utilise que des briques
  livrées avec Python / Spyder (pas de téléchargement à faire) :
      - tkinter    (interface graphique, inclus avec Python)
      - openpyxl   (lecture des liaisons Excel)   <- voir note ci-dessous
      - pywin32    (pilotage d'Excel, Windows)     <- voir note ci-dessous

  COMMENT LANCER DANS SPYDER
  --------------------------
  1. Ouvre ce fichier dans Spyder.
  2. Appuie sur la touche F5 (ou le bouton vert "Run").
  3. La fenêtre "Excel Toolbox" s'ouvre.

  SI UN MESSAGE D'ERREUR "No module named 'openpyxl'" (ou 'win32com')
  -------------------------------------------------------------------
  C'est que la brique manque. Dans la console de Spyder (en bas à droite),
  tape l'une de ces lignes puis Entrée :
      pip install openpyxl
      pip install pywin32
  Si le pare-feu bloque le téléchargement, il faudra passer par l'IT.
  (openpyxl et pywin32 sont souvent déjà présents avec Anaconda/Spyder.)

  CE QUE FAIT L'OUTIL
  -------------------
  - "Actualiser les liaisons" : met à jour les fichiers Excel sélectionnés en
    allant chercher les dernières valeurs dans les autres fichiers liés, dans
    le bon ordre (détecté automatiquement). Sauvegarde de sécurité auto avant.
  - "Créer des versions indépendantes" : crée une copie NomFichier_independant
    où les formules/liaisons sont remplacées par leurs valeurs (fichier
    autonome, sans dépendance). L'original n'est pas modifié.

  Windows uniquement + Excel doit être installé (l'outil pilote Excel).
================================================================================
"""

import os
import queue
import threading
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlparse

import tkinter as tk
from tkinter import filedialog, ttk

# openpyxl sert seulement à repérer les liaisons entre fichiers sans ouvrir
# Excel. Si absent, l'appli démarre quand même et le dira clairement.
try:
    import openpyxl
except ImportError:
    openpyxl = None

SUPPORTED_EXTENSIONS = {".xlsx", ".xlsm"}
BACKUP_FOLDER_NAME = ".backup_excel_toolbox"


# ============================================================================
#  MOTEUR : détection des dépendances entre fichiers
# ============================================================================

def discover_files(paths):
    """Transforme un mélange de fichiers et de dossiers en une liste triée de
    fichiers Excel (les dossiers sont explorés en profondeur)."""
    found = set()
    for raw in paths:
        p = Path(raw)
        if p.is_dir():
            for ext in SUPPORTED_EXTENSIONS:
                found.update(p.rglob(f"*{ext}"))
        elif p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS:
            found.add(p)
    return sorted(f.resolve() for f in found)


def _resolve_target(target, base_dir):
    if not target:
        return None
    if target.startswith("file:///"):
        path_part = unquote(urlparse(target).path)
        if len(path_part) > 2 and path_part[0] == "/" and path_part[2] == ":":
            path_part = path_part[1:]
        return Path(path_part)
    candidate = base_dir / unquote(target)
    try:
        return candidate.resolve()
    except OSError:
        return candidate


def external_targets(xlsx_path):
    """Renvoie les fichiers vers lesquels ce classeur a des liaisons externes.
    N'ouvre pas Excel ; si openpyxl est absent, renvoie un ensemble vide."""
    if openpyxl is None:
        return set()
    try:
        wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=False)
    except Exception:
        return set()
    base_dir = Path(xlsx_path).resolve().parent
    targets = set()
    for link in getattr(wb, "_external_links", []):
        rel = getattr(link, "file_link", None)
        target = getattr(rel, "Target", None) if rel is not None else None
        resolved = _resolve_target(target, base_dir)
        if resolved is not None:
            targets.add(resolved)
    wb.close()
    return targets


def has_external_links(xlsx_path):
    """True/False si on a pu determiner, None si le fichier est illisible.
    None doit etre traite comme "on ne sait pas -> on traite quand meme", pour
    ne jamais ignorer un fichier juste parce qu'openpyxl a echoue a le lire."""
    if openpyxl is None:
        return None
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


def build_graph(files):
    files_set = set(files)
    return {f: {d for d in external_targets(f) if d in files_set} for f in files}


def topological_order(graph):
    """Ordonne les fichiers pour qu'un fichier soit traité APRÈS ceux dont il
    dépend. Renvoie (liste_ordonnée, fichiers_en_boucle)."""
    in_degree = {node: len(deps) for node, deps in graph.items()}
    dependents = {node: set() for node in graph}
    for node, deps in graph.items():
        for dep in deps:
            dependents.setdefault(dep, set()).add(node)

    ready = sorted((n for n, d in in_degree.items() if d == 0), key=str)
    ordered = []
    while ready:
        node = ready.pop(0)
        ordered.append(node)
        for dependent in sorted(dependents.get(node, ()), key=str):
            in_degree[dependent] -= 1
            if in_degree[dependent] == 0:
                ready.append(dependent)

    cycle_nodes = [n for n in graph if n not in ordered]
    return ordered, cycle_nodes


# ============================================================================
#  MOTEUR : sauvegarde de sécurité
# ============================================================================

def backup_file(path, backup_root, run_timestamp):
    """Copie le fichier dans backup_root/<horodatage>/... avant écrasement."""
    import shutil
    path = Path(path).resolve()
    relative = Path(*path.parts[1:]) if path.is_absolute() else path
    dest = Path(backup_root) / run_timestamp / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)
    return dest


# ============================================================================
#  MOTEUR : pilotage d'Excel en arrière-plan (Windows + Excel requis)
# ============================================================================

# Constantes Excel (codées en dur pour éviter toute dépendance annexe).
XL_CALCULATION_MANUAL = -4135
XL_CALCULATION_AUTOMATIC = -4105
XL_LINK_TYPE_EXCEL_LINKS = 1
XL_UPDATE_LINKS_ALWAYS = 3
XL_UPDATE_LINKS_NEVER = 0


class ExcelUnavailableError(RuntimeError):
    pass


class ExcelSession:
    """Une seule instance d'Excel, invisible, réutilisée pour tout le lot."""

    def __init__(self, visible=False):
        self._visible = visible
        self.app = None
        self._keepalive = None
        try:
            import pythoncom  # noqa: F401
            import win32com.client  # noqa: F401
        except ImportError as exc:
            raise ExcelUnavailableError(
                "Le module 'pywin32' est absent. Dans la console Spyder tape :\n"
                "    pip install pywin32\n"
                "(nécessaire pour piloter Excel ; Windows uniquement)."
            ) from exc

    def __enter__(self):
        import pythoncom
        import win32com.client as win32
        pythoncom.CoInitialize()
        try:
            # DispatchEx force une instance Excel dediee et isolee, au lieu de
            # se brancher sur un Excel deja ouvert par l'utilisateur.
            self.app = win32.DispatchEx("Excel.Application")
        except Exception as exc:
            pythoncom.CoUninitialize()
            raise ExcelUnavailableError(
                "Impossible de démarrer Excel. Vérifie qu'Excel est installé."
            ) from exc
        self.app.Visible = self._visible
        self.app.DisplayAlerts = False
        self.app.AskToUpdateLinks = False
        self.app.EnableEvents = False
        self.app.ScreenUpdating = False
        # Excel refuse de régler Application.Calculation tant qu'aucun classeur
        # n'est ouvert ("Impossible de définir la propriété Calculation"). On
        # garde donc un classeur vide ouvert pendant toute la session : le mode
        # manuel reste valable, et les vrais fichiers ne se recalculent pas tout
        # seuls à l'ouverture (on recalcule nous-mêmes, au bon moment).
        self._keepalive = self.app.Workbooks.Add()
        try:
            self.app.Calculation = XL_CALCULATION_MANUAL
        except Exception:
            pass
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        import pythoncom
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

    def refresh_links(self, path):
        wb = self.app.Workbooks.Open(
            str(path), UpdateLinks=XL_UPDATE_LINKS_ALWAYS, ReadOnly=False,
            IgnoreReadOnlyRecommended=True, Notify=False,
        )
        try:
            # CalculateFull recalcule toutes les formules avec les valeurs de
            # liaisons fraiches, mais SANS reconstruire l'arbre des dependances
            # (ce que fait CalculateFullRebuild). Comme on ne modifie pas les
            # formules, c'est aussi correct et beaucoup plus rapide.
            try:
                self.app.CalculateFull()
            except Exception:
                self.app.Calculate()
            try:
                self.app.CalculateUntilAsyncQueriesDone()
            except Exception:
                pass
            wb.Save()
        finally:
            self._safe_close(wb)

    @staticmethod
    def _safe_close(wb):
        """Ferme un classeur sans qu'un accroc de fermeture fasse echouer tout
        le lot. Marquer le classeur comme "deja enregistre" empeche Excel de
        vouloir afficher une boite de dialogue (qu'il ne peut pas montrer, les
        alertes etant coupees) -> c'est la cause du "La methode Close ... a
        echoue". L'enregistrement a deja eu lieu avant, rien n'est perdu."""
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

    def flatten_to_values(self, src_path, dst_path):
        wb = self.app.Workbooks.Open(
            str(src_path), UpdateLinks=XL_UPDATE_LINKS_NEVER, ReadOnly=True,
            IgnoreReadOnlyRecommended=True, Notify=False,
        )
        try:
            for sheet in wb.Sheets:
                used = sheet.UsedRange
                used.Value = used.Value
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


# ============================================================================
#  ORCHESTRATION : scan -> ordre -> backup -> action
# ============================================================================

def run_batch(paths, action, backup_root, on_event, make_backup=True):
    """Traite tout le lot. on_event(dict) est appelé pour chaque étape afin
    que l'interface reste réactive."""
    files = discover_files(paths)
    graph = build_graph(files)
    ordered, cycles = topological_order(graph)

    if cycles:
        names = ", ".join(p.name for p in cycles)
        on_event({"kind": "log",
                  "message": f"Reference circulaire : {names} (ordre non garanti)"})
        ordered = ordered + cycles

    # En mode actualisation, un fichier sans aucune liaison externe n'a rien a
    # mettre a jour : inutile de l'ouvrir et de le re-sauvegarder. On saute ces
    # fichiers. Ceux qu'on ne peut pas lire (None) sont conserves, jamais sautes.
    skipped = []
    if action == "refresh_links":
        kept = []
        for f in ordered:
            if has_external_links(f) is False:
                skipped.append(f)
            else:
                kept.append(f)
        ordered = kept

    total = len(ordered)
    on_event({"kind": "plan", "total": total,
              "message": f"{total} fichier(s) à traiter"})
    for f in skipped:
        on_event({"kind": "log", "message": f"ignore (aucune liaison) : {f.name}"})

    run_timestamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")

    try:
        with ExcelSession() as excel:
            for index, file in enumerate(ordered, start=1):
                on_event({"kind": "start", "file": file,
                          "index": index, "total": total})
                try:
                    if make_backup:
                        backup_file(file, backup_root, run_timestamp)
                    if action == "refresh_links":
                        excel.refresh_links(file)
                    else:
                        dst = file.with_name(f"{file.stem}_independant{file.suffix}")
                        excel.flatten_to_values(file, dst)
                    on_event({"kind": "done", "file": file,
                              "index": index, "total": total})
                except Exception as exc:
                    on_event({"kind": "error", "file": file, "index": index,
                              "total": total, "message": str(exc)})
    except ExcelUnavailableError as exc:
        on_event({"kind": "finished", "message": str(exc)})
        return

    on_event({"kind": "finished", "message": "Termine"})


# ============================================================================
#  INTERFACE GRAPHIQUE (tkinter, inclus avec Python)
# ============================================================================

class App(tk.Tk):
    BG = "#f4f5f7"
    ACCENT = "#2f6fed"
    ACCENT2 = "#6f42c1"

    def __init__(self):
        super().__init__()
        self.title("Excel Toolbox")
        self.geometry("720x600")
        self.minsize(600, 480)
        self.configure(bg=self.BG)

        self.selected_paths = []
        self._event_queue = queue.Queue()
        self._worker = None

        self._build_style()
        self._build_widgets()
        self.after(100, self._drain_events)

    def _build_style(self):
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure("TFrame", background=self.BG)
        style.configure("TLabel", background=self.BG, font=("Segoe UI", 10))
        style.configure("Title.TLabel", font=("Segoe UI", 18, "bold"))
        style.configure("Sub.TLabel", foreground="#555555", font=("Segoe UI", 9))
        style.configure("Accent.TButton", font=("Segoe UI", 10, "bold"),
                        padding=8)
        style.configure("TButton", font=("Segoe UI", 10), padding=6)
        style.configure("Horizontal.TProgressbar", troughcolor="#e3e5e8",
                        background=self.ACCENT)

    def _build_widgets(self):
        pad = {"padx": 18}

        ttk.Label(self, text="Excel Toolbox", style="Title.TLabel").pack(
            anchor="w", pady=(16, 2), **pad)
        ttk.Label(
            self,
            text="Actualise des classeurs Excel liés entre eux, ou crée des "
                 "versions indépendantes sans liaisons.",
            style="Sub.TLabel", wraplength=660, justify="left",
        ).pack(anchor="w", pady=(0, 12), **pad)

        # Sélection de fichiers
        btn_row = ttk.Frame(self)
        btn_row.pack(fill="x", pady=(0, 8), **pad)
        ttk.Button(btn_row, text="Choisir des fichiers...",
                   command=self._browse_files).pack(side="left")
        ttk.Button(btn_row, text="Choisir un dossier...",
                   command=self._browse_folder).pack(side="left", padx=6)
        ttk.Button(btn_row, text="Vider la liste",
                   command=self._clear_selection).pack(side="left")

        # Liste des fichiers sélectionnés
        list_frame = ttk.Frame(self)
        list_frame.pack(fill="both", expand=False, **pad)
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical")
        self.file_list = tk.Listbox(
            list_frame, height=6, yscrollcommand=scrollbar.set,
            font=("Consolas", 9), activestyle="none", bd=1, relief="solid",
            highlightthickness=0,
        )
        scrollbar.config(command=self.file_list.yview)
        scrollbar.pack(side="right", fill="y")
        self.file_list.pack(side="left", fill="both", expand=True)

        # Boutons d'action
        action_row = ttk.Frame(self)
        action_row.pack(fill="x", pady=12, **pad)
        self.refresh_button = tk.Button(
            action_row, text="Actualiser les liaisons",
            command=lambda: self._start("refresh_links"),
            bg=self.ACCENT, fg="white", font=("Segoe UI", 10, "bold"),
            relief="flat", padx=14, pady=10, cursor="hand2",
            activebackground="#2559c9", activeforeground="white",
        )
        self.refresh_button.pack(side="left")
        self.flatten_button = tk.Button(
            action_row, text="Creer des versions independantes",
            command=lambda: self._start("flatten_to_values"),
            bg=self.ACCENT2, fg="white", font=("Segoe UI", 10, "bold"),
            relief="flat", padx=14, pady=10, cursor="hand2",
            activebackground="#5a349a", activeforeground="white",
        )
        self.flatten_button.pack(side="left", padx=8)

        # Option : sauvegarde de sécurité
        self.backup_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(
            self, variable=self.backup_var,
            text="Sauvegarde de securite avant modification (plus sur, un peu plus lent)",
        ).pack(anchor="w", **pad)

        # Progression
        self.progress = ttk.Progressbar(self, mode="determinate", maximum=100)
        self.progress.pack(fill="x", pady=(4, 2), **pad)
        self.status_label = ttk.Label(self, text="Pret.", style="Sub.TLabel")
        self.status_label.pack(anchor="w", **pad)

        # Journal
        log_frame = ttk.Frame(self)
        log_frame.pack(fill="both", expand=True, pady=(6, 16), **pad)
        log_scroll = ttk.Scrollbar(log_frame, orient="vertical")
        self.log_box = tk.Text(
            log_frame, height=8, yscrollcommand=log_scroll.set,
            font=("Consolas", 9), bd=1, relief="solid", state="disabled",
            wrap="none", highlightthickness=0,
        )
        log_scroll.config(command=self.log_box.yview)
        log_scroll.pack(side="right", fill="y")
        self.log_box.pack(side="left", fill="both", expand=True)

        if openpyxl is None:
            self._log("Note : openpyxl absent -> l'ordre des dependances ne "
                      "sera pas detecte. Installe-le avec : pip install openpyxl")

    # ---------------- sélection ----------------

    def _browse_files(self):
        paths = filedialog.askopenfilenames(
            title="Choisir des fichiers Excel",
            filetypes=[("Fichiers Excel", "*.xlsx *.xlsm")],
        )
        self._add_paths(paths)

    def _browse_folder(self):
        path = filedialog.askdirectory(title="Choisir un dossier")
        if path:
            self._add_paths([path])

    def _add_paths(self, raw_paths):
        for raw in raw_paths:
            p = Path(raw).resolve()
            if p not in self.selected_paths:
                self.selected_paths.append(p)
        self._refresh_file_list()

    def _clear_selection(self):
        self.selected_paths = []
        self._refresh_file_list()

    def _refresh_file_list(self):
        self.file_list.delete(0, "end")
        for p in self.selected_paths:
            label = p.name if p.is_file() else f"[dossier] {p.name}"
            self.file_list.insert("end", label)
        if not self.selected_paths:
            self.file_list.insert("end", "  (aucun fichier selectionne)")

    # ---------------- exécution ----------------

    def _start(self, action):
        if not self.selected_paths:
            self._log("Selectionne d'abord des fichiers ou un dossier.")
            return
        if self._worker and self._worker.is_alive():
            return
        self._set_running(True)
        self._clear_log()
        backup_root = self._common_parent(self.selected_paths) / BACKUP_FOLDER_NAME
        make_backup = bool(self.backup_var.get())
        self._worker = threading.Thread(
            target=run_batch,
            args=(list(self.selected_paths), action, backup_root,
                  self._event_queue.put),
            kwargs={"make_backup": make_backup},
            daemon=True,
        )
        self._worker.start()

    @staticmethod
    def _common_parent(paths):
        roots = [p if p.is_dir() else p.parent for p in paths]
        return Path(os.path.commonpath([str(r) for r in roots]))

    def _set_running(self, running):
        state = "disabled" if running else "normal"
        self.refresh_button.config(state=state)
        self.flatten_button.config(state=state)

    # ---------------- événements ----------------

    def _drain_events(self):
        try:
            while True:
                event = self._event_queue.get_nowait()
                self._handle_event(event)
        except queue.Empty:
            pass
        self.after(100, self._drain_events)

    def _handle_event(self, event):
        kind = event.get("kind")
        total = event.get("total", 0) or 0
        index = event.get("index", 0)
        if kind == "plan":
            self.status_label.config(text=event.get("message", ""))
            self.progress.config(value=0)
        elif kind == "start":
            self.status_label.config(
                text=f"[{index}/{total}] {event['file'].name}...")
        elif kind == "done":
            self.progress.config(value=(index / total * 100) if total else 0)
            self._log(f"OK   {event['file'].name}")
        elif kind == "error":
            self.progress.config(value=(index / total * 100) if total else 0)
            self._log(f"ECHEC {event['file'].name} -- {event.get('message','')}")
        elif kind == "log":
            self._log(event.get("message", ""))
        elif kind == "finished":
            self.status_label.config(text=event.get("message", "Termine"))
            self._set_running(False)

    def _log(self, line):
        self.log_box.config(state="normal")
        self.log_box.insert("end", line + "\n")
        self.log_box.see("end")
        self.log_box.config(state="disabled")

    def _clear_log(self):
        self.log_box.config(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.config(state="disabled")
        self.progress.config(value=0)


def main():
    app = App()
    app._refresh_file_list()
    app.mainloop()


if __name__ == "__main__":
    main()
