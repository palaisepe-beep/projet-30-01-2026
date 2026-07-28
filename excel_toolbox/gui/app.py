"""The graphical shell: drag-and-drop / browse for files or a folder, pick an
action, watch progress. All the actual work happens in
`excel_toolbox.engine.pipeline.run_batch`, run on a background thread so the
window never freezes -- this module only collects input and renders events.
"""
from __future__ import annotations

import os
import queue
import threading
from pathlib import Path
from tkinter import filedialog

import customtkinter as ctk
from tkinterdnd2 import DND_FILES, TkinterDnD

from ..engine.pipeline import Event, run_batch

ctk.set_appearance_mode("system")
ctk.set_default_color_theme("blue")

WINDOW_TITLE = "Excel Toolbox"
BACKUP_FOLDER_NAME = ".backup_excel_toolbox"


class CTkDnD(ctk.CTk, TkinterDnD.DnDWrapper):
    """customtkinter's CTk window plus tkinterdnd2's drag-and-drop mixin --
    the two don't ship a combined class, this is the standard glue for it."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.TkdndVersion = TkinterDnD._require(self)


class App(CTkDnD):
    def __init__(self):
        super().__init__()
        self.title(WINDOW_TITLE)
        self.geometry("760x620")
        self.minsize(620, 480)

        self.selected_paths: list[Path] = []
        self._event_queue: queue.Queue[Event] = queue.Queue()
        self._worker: threading.Thread | None = None

        self._build_widgets()
        self.after(100, self._drain_events)

    # ------------------------------------------------------------------ UI

    def _build_widgets(self) -> None:
        self.grid_columnconfigure(0, weight=1)

        header = ctk.CTkLabel(
            self, text="Excel Toolbox", font=ctk.CTkFont(size=22, weight="bold")
        )
        header.grid(row=0, column=0, padx=24, pady=(20, 4), sticky="w")

        subheader = ctk.CTkLabel(
            self,
            text="Actualise des classeurs Excel liés entre eux, ou crée des versions "
                 "indépendantes sans liaisons externes.",
            font=ctk.CTkFont(size=13),
            text_color=("gray30", "gray70"),
            justify="left",
        )
        subheader.grid(row=1, column=0, padx=24, pady=(0, 16), sticky="w")

        self.drop_zone = ctk.CTkFrame(
            self, height=140, corner_radius=12, border_width=2, border_color=("gray70", "gray40")
        )
        self.drop_zone.grid(row=2, column=0, padx=24, pady=8, sticky="ew")
        self.drop_zone.grid_propagate(False)
        self.drop_zone.grid_columnconfigure(0, weight=1)
        self.drop_zone.grid_rowconfigure(0, weight=1)

        self.drop_label = ctk.CTkLabel(
            self.drop_zone,
            text="Glisse-dépose des fichiers Excel ou un dossier ici",
            font=ctk.CTkFont(size=14),
        )
        self.drop_label.grid(row=0, column=0, pady=(20, 8))

        self.drop_zone.drop_target_register(DND_FILES)
        self.drop_zone.dnd_bind("<<Drop>>", self._on_drop)

        browse_row = ctk.CTkFrame(self, fg_color="transparent")
        browse_row.grid(row=3, column=0, padx=24, pady=(0, 8), sticky="ew")
        ctk.CTkButton(
            browse_row, text="Choisir des fichiers…", command=self._browse_files
        ).pack(side="left", padx=(0, 8))
        ctk.CTkButton(
            browse_row, text="Choisir un dossier…", command=self._browse_folder
        ).pack(side="left")
        ctk.CTkButton(
            browse_row, text="Vider la sélection", fg_color="transparent",
            border_width=1, text_color=("gray20", "gray80"), command=self._clear_selection,
        ).pack(side="left", padx=8)

        self.selection_label = ctk.CTkLabel(
            self, text="Aucun fichier sélectionné.", font=ctk.CTkFont(size=13)
        )
        self.selection_label.grid(row=4, column=0, padx=24, pady=(0, 12), sticky="w")

        action_row = ctk.CTkFrame(self, fg_color="transparent")
        action_row.grid(row=5, column=0, padx=24, pady=(0, 12), sticky="ew")
        self.refresh_button = ctk.CTkButton(
            action_row, text="Actualiser les liaisons", height=40,
            command=lambda: self._start("refresh_links"),
        )
        self.refresh_button.pack(side="left", padx=(0, 8))
        self.flatten_button = ctk.CTkButton(
            action_row, text="Créer des versions indépendantes", height=40,
            fg_color="#6f42c1", hover_color="#5a349a",
            command=lambda: self._start("flatten_to_values"),
        )
        self.flatten_button.pack(side="left")

        self.progress = ctk.CTkProgressBar(self)
        self.progress.set(0)
        self.progress.grid(row=6, column=0, padx=24, pady=(8, 4), sticky="ew")

        self.status_label = ctk.CTkLabel(self, text="", font=ctk.CTkFont(size=12))
        self.status_label.grid(row=7, column=0, padx=24, pady=(0, 8), sticky="w")

        self.log_box = ctk.CTkTextbox(self, wrap="none")
        self.log_box.grid(row=8, column=0, padx=24, pady=(0, 20), sticky="nsew")
        self.grid_rowconfigure(8, weight=1)
        self.log_box.configure(state="disabled")

    # ------------------------------------------------------------ selection

    def _on_drop(self, event) -> None:
        raw_paths = self.tk.splitlist(event.data)
        self._add_paths(raw_paths)

    def _browse_files(self) -> None:
        paths = filedialog.askopenfilenames(
            title="Choisir des fichiers Excel",
            filetypes=[("Fichiers Excel", "*.xlsx *.xlsm")],
        )
        self._add_paths(paths)

    def _browse_folder(self) -> None:
        path = filedialog.askdirectory(title="Choisir un dossier")
        if path:
            self._add_paths([path])

    def _add_paths(self, raw_paths) -> None:
        for raw in raw_paths:
            p = Path(raw).resolve()
            if p not in self.selected_paths:
                self.selected_paths.append(p)
        self._refresh_selection_label()

    def _clear_selection(self) -> None:
        self.selected_paths = []
        self._refresh_selection_label()

    def _refresh_selection_label(self) -> None:
        if not self.selected_paths:
            self.selection_label.configure(text="Aucun fichier sélectionné.")
            return
        names = ", ".join(p.name for p in self.selected_paths[:4])
        extra = f" (+{len(self.selected_paths) - 4})" if len(self.selected_paths) > 4 else ""
        self.selection_label.configure(text=f"Sélection : {names}{extra}")

    # ---------------------------------------------------------------- run

    def _start(self, action: str) -> None:
        if not self.selected_paths:
            self._log("Sélectionne d'abord des fichiers ou un dossier.")
            return
        if self._worker and self._worker.is_alive():
            return

        self._set_running(True)
        self._clear_log()
        backup_root = self._common_parent(self.selected_paths) / BACKUP_FOLDER_NAME

        self._worker = threading.Thread(
            target=run_batch,
            args=(self.selected_paths, action, backup_root, self._event_queue.put),
            daemon=True,
        )
        self._worker.start()

    @staticmethod
    def _common_parent(paths: list[Path]) -> Path:
        roots = [p if p.is_dir() else p.parent for p in paths]
        return Path(os.path.commonpath([str(r) for r in roots]))

    def _set_running(self, running: bool) -> None:
        state = "disabled" if running else "normal"
        self.refresh_button.configure(state=state)
        self.flatten_button.configure(state=state)

    # ------------------------------------------------------------- events

    def _drain_events(self) -> None:
        try:
            while True:
                event = self._event_queue.get_nowait()
                self._handle_event(event)
        except queue.Empty:
            pass
        self.after(100, self._drain_events)

    def _handle_event(self, event: Event) -> None:
        if event.kind == "plan":
            self.status_label.configure(text=event.message)
        elif event.kind == "start_file":
            self.status_label.configure(text=f"[{event.index}/{event.total}] {event.file.name}…")
        elif event.kind == "file_done":
            self.progress.set(event.index / event.total if event.total else 0)
            self._log(f"✓ {event.file.name}")
        elif event.kind == "file_error":
            self.progress.set(event.index / event.total if event.total else 0)
            self._log(f"✗ {event.file.name} — {event.message}")
        elif event.kind == "file_skip":
            self._log(f"– {event.file.name} (ignoré : {event.message})")
        elif event.kind == "cycle_warning":
            self._log(f"⚠ {event.message}")
        elif event.kind == "finished":
            self.status_label.configure(text=event.message)
            self._set_running(False)

    def _log(self, line: str) -> None:
        self.log_box.configure(state="normal")
        self.log_box.insert("end", line + "\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _clear_log(self) -> None:
        self.log_box.configure(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.configure(state="disabled")
        self.progress.set(0)


def run_gui() -> None:
    app = App()
    app.mainloop()
