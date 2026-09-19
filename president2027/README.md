# Président 2027 🇫🇷

**Jeu de simulation politique en français, jouable dans le navigateur.** Vous
êtes **Président de la République** à l'automne 2026 : déficit à 5,9 % du PIB,
dette à 118 %, Assemblée sans majorité, Bruxelles et les agences de notation qui
surveillent, une guerre à l'Est. La présidentielle de 2027 approche. À vous de
gouverner — et de durer jusqu'en 2032.

Inspiré de *La Bataille du Budget* (Rayan Nezzar), mais élargi à **tous les
champs du pouvoir présidentiel** : budget et dette, mais aussi institutions,
Europe, diplomatie, défense, société, communication et élections.

> Application 100 % statique · aucun backend · sauvegarde locale · personnages
> **fictifs** · chiffres en ordres de grandeur.

---

## Lancer le jeu

Pré-requis : **Node.js 20+** (développé et testé avec Node 22).

```bash
cd president2027
npm install
npm run dev        # serveur de développement (http://localhost:5173)
```

Pour une version de production (statique, déployable) :

```bash
npm run build      # génère dist/
npm run preview    # sert dist/ localement (http://localhost:4173)
```

### Déploiement Netlify
Le fichier `netlify.toml` est fourni. Réglages : base `president2027`, commande
`npm install && npm run build`, dossier publié `president2027/dist`. Le contenu
de `dist/` est du HTML/CSS/JS statique : il se déploie aussi sur n'importe quel
hébergement statique (GitHub Pages, Vercel, un simple serveur de fichiers…).

### Tests et simulation (sans build)
Node 22 exécute directement le TypeScript, donc **aucune dépendance** n'est
nécessaire pour les tests et la simulation :

```bash
npm test           # tests unitaires du moteur (node --test)
npm run sim        # 1000 parties automatiques d'équilibrage
npm run sim:full   # 5000 parties
node src/sim/run.ts 250 realiste complet   # N parties / difficulté / mode
```

---

## Comment jouer

1. **Accueil** : choisissez un **profil** (technocrate, tribun, réformateur,
   souverainiste, écologiste — bonus/malus différents), une **difficulté**
   (facile → impitoyable), un **mode** (complet, campagne, bac à sable) et une
   **graine** partageable.
2. **Chaque tour** (un trimestre, un mois pendant la campagne) :
   - lisez le **briefing** et les **dépêches** ;
   - traitez le(s) **événement(s)** (chaque choix a des conséquences) ;
   - dépensez votre **capital politique** et vos **points d'action** sur des
     **mesures** (400+ leviers prévus, une centaine implémentés et documentés)
     ou des **pouvoirs** présidentiels (49.3, dissolution, référendum, art. 16…) ;
   - cliquez **« Terminer le trimestre »** pour la résolution.
3. **Objectif** : traverser la **présidentielle de 2027**, puis mener le pays
   jusqu'en 2032 avec le meilleur bilan possible (déficit, dette, emploi,
   cohésion, rang international). Attention aux **défaites** : censure,
   effondrement de la popularité, crise de la dette, troubles civils.

Astuce : chaque mesure affiche une **info-bulle pédagogique** (ce qu'elle fait
vraiment) et son **ordre de grandeur budgétaire**. Le **mode pédagogique**
(barre du bas) explique après chaque tour *pourquoi* les chiffres ont bougé.

---

## Fonctionnalités

- **Moteur de simulation pur et déterministe** (RNG à graine) : économie
  (déficit, dette, taux, spread, notations), opinion par catégorie sociale,
  Assemblée et risque de censure, société, international.
- **Effets différés** : les réformes structurelles (retraites, éducation, LPM…)
  paient dans plusieurs années — arbitrage court terme / long terme.
- **Élections 2027** modélisées : premier tour à 5-6 candidats fictifs, second
  tour avec reports de voix, abstention, front républicain, effet sortant ;
  **législatives** et **cohabitation** possibles.
- **Pouvoirs constitutionnels** avec contraintes réalistes.
- **~100 mesures** couvrant droite/gauche/centre, chiffrées et documentées
  (champ `source_ou_ordre_de_grandeur`), **~50 événements** avec arbres de choix
  et chaînes narratives, **5 profils**, **conseillers** aux avis parfois faux.
- **Interface** sobre et institutionnelle, **responsive** (mobile d'abord),
  **accessible** (contrastes, focus clavier, thème clair/sombre), avec
  **graphiques d'évolution** (SVG), **journal de mandat**, **sondages**.
- **Sauvegarde automatique** (`localStorage`), **export/import** de partie,
  **graine partageable**, **carte de résultats** à copier, **succès**,
  **classement local**.

## Structure du code

```
president2027/
├── DESIGN.md            # conception : boucle, jauges, formules, tests
├── BALANCE.md           # rapport d'équilibrage (simulation)
├── src/
│   ├── engine/          # MOTEUR PUR (sans UI) — types, rng, economy, opinion,
│   │                    #   measures, events, elections, victory, engine
│   ├── data/            # mesures, événements, personnages, pays, profils…
│   ├── sim/             # stratégies + runner d'équilibrage
│   └── ui/              # application statique (main, charts, styles)
└── index.html
```

Le moteur (`src/engine`) ne dépend d'aucune API navigateur : il est testé et
simulé sous Node, et réutilisé tel quel par l'interface. Toutes les données sont
dans `src/data` et faciles à modifier (chaque nombre porte un ordre de grandeur).

## Équilibrage

Voir `BALANCE.md`. En bref, sur 1000 parties automatiques (difficulté normale) :
aucune stratégie ne domine (la meilleure plafonne ~20 %), les stratégies naïves
échouent (< 1 %), et un **joueur réfléchi gagne ~10-20 %** selon la difficulté —
« difficile mais possible ». La stratégie dépensière meurt de la dette, la
stratégie de rigueur perd l'élection : le dilemme central est vérifié.

## Limites connues

- **Modèle simplifié** : ce n'est pas une comptabilité nationale ni une
  prévision. Les liens causaux sont plausibles mais schématiques ; les chiffres
  sont des **ordres de grandeur** (signalés dans les données).
- **Contenu** : ~100 mesures et ~50 événements sont implémentés (les cibles de
  400/250 du cahier des charges sont dépassables en ajoutant des entrées dans
  `src/data/measures.ts` et `src/data/events.ts` — le schéma est prévu pour).
- **Personnages fictifs** : aucune personne réelle n'est représentée ni
  caricaturée. Les partis sont fictifs, reconnaissables par leur famille
  politique.
- **Guerre / défense** : modélisées via événements et jauges (armée, munitions,
  moral, relations), sans détails opérationnels irréalistes.
- Les avis des conseillers sont volontairement parfois **erronés** (à vous de
  les juger).

## Licence & mentions

Projet pédagogique. Institutions réelles, **personnages fictifs**. Inspiré de
*La Bataille du Budget*. Ce jeu n'exprime aucune préférence partisane : les
mesures de droite, de gauche et du centre sont chiffrées avec la même rigueur,
avec leurs avantages **et** leurs inconvénients.
