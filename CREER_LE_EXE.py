"""
================================================================================
  CREER_LE_EXE  -  Fabrique ExcelToolbox.exe automatiquement
================================================================================

  A QUOI CA SERT
  --------------
  Transforme le fichier "ExcelToolbox.py" en un vrai "ExcelToolbox.exe" que
  tes collegues pourront double-cliquer SANS installer Python. Le .exe est
  cree directement sur ce PC : il n'a pas a passer par le pare-feu.

  COMMENT L'UTILISER (dans Spyder)
  --------------------------------
  1. Mets ce fichier DANS LE MEME DOSSIER que "ExcelToolbox.py".
     (les deux cote a cote, dans le meme dossier)
  2. Ouvre ce fichier dans Spyder.
  3. Appuie sur F5 (bouton vert "Run").
  4. Patiente 1 a 3 minutes : plein de lignes vont defiler, c'est normal.
  5. A la fin, le chemin de ton .exe s'affiche. Il est dans un nouveau
     sous-dossier appele "dist".

  IMPORTANT
  ---------
  - La 1ere fois, ce script telecharge un outil (PyInstaller). Il faut donc
    qu'internet ne soit pas totalement bloque. Si le telechargement echoue
    (pare-feu), il faudra demander a l'IT d'autoriser "pip install pyinstaller"
    ou de fabriquer le .exe pour toi.
  - Le .exe genere n'est pas signe : l'antivirus de l'entreprise peut le
    bloquer. Teste-le, et au besoin demande a l'IT de l'autoriser.
================================================================================
"""

import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
APP = HERE / "ExcelToolbox.py"


def run(cmd):
    print(">>>", " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True)


def ensure(pip_name, import_name=None):
    """Installe le paquet seulement s'il n'est pas deja present."""
    try:
        __import__(import_name or pip_name)
        print(f"  OK  {pip_name} deja present")
    except ImportError:
        print(f"  ... installation de {pip_name}")
        run([sys.executable, "-m", "pip", "install", pip_name])


def main():
    print("Dossier de travail :", HERE)

    if not APP.exists():
        print()
        print("ERREUR : 'ExcelToolbox.py' est introuvable dans ce dossier.")
        print("Place CREER_LE_EXE.py ET ExcelToolbox.py dans le MEME dossier,")
        print("puis relance (F5).")
        return

    print("\nVerification des outils necessaires :")
    ensure("pyinstaller", "PyInstaller")
    ensure("openpyxl", "openpyxl")
    ensure("pywin32", "win32com")

    print("\nFabrication du .exe (ca peut prendre 1 a 3 minutes)...\n")
    run([
        sys.executable, "-m", "PyInstaller",
        "--onefile",          # tout dans un seul fichier .exe
        "--windowed",         # pas de fenetre noire quand on double-clique
        "--noconfirm",
        "--name", "ExcelToolbox",
        "--hidden-import", "win32timezone",   # requis par pywin32
        str(APP),
    ])

    exe = HERE / "dist" / "ExcelToolbox.exe"
    print("\n" + "=" * 64)
    if exe.exists():
        print("TERMINE !  Ton executable est ici :")
        print("   ", exe)
        print("\nC'est CE fichier que tu partages avec l'equipe.")
        print("(Leur PC doit avoir Excel installe.)")
    else:
        print("Le build s'est termine mais le .exe est introuvable.")
        print("Regarde s'il y a un message d'erreur rouge plus haut.")
    print("=" * 64)


if __name__ == "__main__":
    main()
