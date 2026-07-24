# Excel Toolbox

Outil interne pour actualiser des classeurs Excel liés entre eux, et pour
créer des copies indépendantes (sans liaisons externes) prêtes à être
partagées. Distribué à l'équipe sous forme d'un seul `.exe` Windows — pas
besoin de Python, VS Code ou quoi que ce soit d'installé, seul Excel doit
être présent sur le poste.

## Fonctionnalités

- **Actualiser les liaisons** : sélectionne une liste de fichiers ou un
  dossier (glisser-déposer ou boutons "Parcourir"). L'outil détecte
  automatiquement les dépendances entre les fichiers (qui référence qui) et
  les met à jour dans le bon ordre, puis recalcule et sauvegarde. Une
  sauvegarde des fichiers d'origine est faite automatiquement avant toute
  écriture (dossier `.backup_excel_toolbox` créé à côté des fichiers
  sélectionnés).
- **Créer des versions indépendantes** : pour chaque fichier sélectionné,
  crée une copie `NomDuFichier_independant.xlsx` où toutes les formules
  (y compris celles qui vont chercher des données dans d'autres classeurs)
  sont remplacées par leur dernière valeur calculée. Le fichier original
  n'est jamais modifié par cette action.

## Architecture

```
excel_toolbox/
  engine/
    dependency_graph.py  # scan des liaisons externes (openpyxl) + tri topologique
    backup.py            # sauvegarde horodatée avant écriture
    com_session.py        # pilotage d'Excel en tâche de fond (pywin32/COM)
    pipeline.py            # orchestration : scan -> ordre -> backup -> action
  gui/
    app.py                # fenêtre customtkinter + glisser-déposer
main.py                    # point d'entrée
build.py                   # génère le .exe avec PyInstaller
```

Le moteur (`engine/`) ne dépend pas de l'interface graphique et est testé
indépendamment (voir `tests/`). Seul `com_session.py` a besoin de Windows +
Excel pour fonctionner réellement ; le reste tourne partout.

### Pourquoi piloter Excel plutôt que réimplémenter le calcul ?

Excel étant installé sur tous les postes de l'équipe, l'outil pilote une
instance d'Excel en arrière-plan (invisible) au lieu de recalculer les
formules lui-même. Ça garantit un résultat identique à ce que ferait un
utilisateur dans Excel (formules complexes, tableaux croisés dynamiques
compris), sans avoir à réimplémenter le moteur de calcul.

**Performance** : une seule instance Excel est réutilisée pour tout le lot
de fichiers (au lieu d'en relancer une par fichier) — le démarrage d'Excel
(~1-2s) est le principal coût fixe, ça évite de le payer N fois.

## Installation (développement)

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements-dev.txt
```

## Lancer sans compiler

```bash
python main.py
```

## Tests

```bash
pytest
```

Les tests couvrent la détection des dépendances, le tri topologique, la
sauvegarde, et l'orchestration (avec une fausse session Excel). Ils tournent
sur n'importe quel OS. **Ils ne testent pas `com_session.py`** (l'automation
COM réelle) : ce module a été écrit avec soin mais n'a pas pu être exécuté
pendant le développement (environnement Linux sans Excel) — à valider en
priorité sur un vrai poste Windows avant diffusion à l'équipe.

## Construire le .exe

Sur un poste Windows avec Excel installé :

```bash
python build.py
```

Le fichier `dist/ExcelToolbox.exe` est celui à partager avec l'équipe.

### ⚠️ Antivirus / sécurité d'entreprise

Les `.exe` générés par PyInstaller (non signés) sont parfois bloqués ou
mis en quarantaine par un antivirus d'entreprise ou Windows Defender/EDR,
car ils embarquent un interpréteur Python et ne sont pas signés
numériquement. Avant de diffuser l'outil à toute l'équipe :

- Teste le `.exe` sur un poste représentatif avec l'antivirus de l'entreprise actif.
- Si besoin, demande à l'IT de whitelister l'exécutable ou de le signer
  avec un certificat d'entreprise.

## Notes

- Formats supportés : `.xlsx` et `.xlsm`.
- Windows uniquement (l'automation Excel via COM n'existe pas sur macOS/Linux).
- En cas de référence circulaire entre fichiers (A dépend de B qui dépend de
  A), l'outil le signale dans le journal et traite quand même les fichiers
  concernés, mais l'ordre n'est plus garanti pour eux.
