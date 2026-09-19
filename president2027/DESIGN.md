# Président 2027 — Document de conception (`DESIGN.md`)

> Jeu de simulation politique en français. Le joueur est **Président de la
> République** à l'automne 2026 ; la présidentielle de 2027 est le cœur du jeu ;
> un second mandat court jusqu'en 2032. Inspiré de *La Bataille du Budget* mais
> élargi à tous les champs du pouvoir présidentiel.

Ce document décrit la **boucle de jeu**, les **jauges**, les **formules
d'impact**, la **structure des données**, l'**architecture** et le **plan de
test**. Il est écrit *avant* le code et fait autorité : le moteur suit ces
formules, les données suivent ces schémas.

---

## 1. Principes de conception

1. **Le moteur est pur.** `src/engine/` ne connaît ni le DOM, ni `localStorage`,
   ni `Math.random`. Il prend un état + une action et renvoie un nouvel état.
   C'est ce qui permet de le tester et de simuler 1 000 parties.
2. **Déterminisme par graine.** Tout l'aléa passe par un RNG à graine
   (`mulberry32`) dont l'état 32 bits est stocké dans la partie. Même graine +
   mêmes décisions ⇒ même partie. La graine est visible et partageable.
3. **Tout est donnée.** Mesures, événements, personnages, pays, profils,
   succès : des tableaux TypeScript typés, faciles à éditer. Chaque nombre porte
   un champ `source_ou_ordre_de_grandeur`.
4. **Causalité plausible, pas exactitude.** Les ordres de grandeur sont calés
   sur la réalité budgétaire française (PIB ~3 000 Md€, dette ~3 500 Md€, charge
   d'intérêts ~60-70 Md€/an). Les *liens* comptent plus que la précision : plus
   de taux ⇒ plus de charge ⇒ moins de marge ; austérité ⇒ moins de croissance
   ⇒ moins de recettes ; inflation ⇒ colère ⇒ popularité en baisse.
5. **Neutralité politique.** Les leviers de gauche, de centre et de droite sont
   présents, chiffrés avec la même rigueur, avec avantages **et** inconvénients.
   Le jeu ne dit jamais quelle politique est « la bonne ».
6. **Court terme contre long terme.** De nombreux effets sont *différés* (une
   réforme des retraites, de l'éducation ou une loi de programmation militaire
   paie dans 3 à 5 ans). Le joueur arbitre en permanence, l'élection en ligne de
   mire.

---

## 2. Boucle de jeu

### 2.1 Unité de temps
Un **tour = un trimestre** (T3-2026 → T4-2032, soit ~26 tours). Pendant la
**campagne** (T1-2027 → présidentielle), les tours passent au **mois** pour
densifier la fin de course. Chaque tour a une `Phase` : `MANDAT`, `CAMPAGNE`,
`ELECTION`, `FIN`.

### 2.2 Déroulé d'un tour (`resolveTurn`)
1. **Effets différés** — on applique les `PendingEffect` programmés pour ce tour
   (issus de mesures/événements passés).
2. **Macro-économie** (`economy.ts`) — croissance, chômage, inflation, taux,
   charge de la dette, déficit, dette, notations, spread.
3. **Opinion & Assemblée** (`opinion.ts`) — popularité par groupe et globale,
   capital politique, soutien parlementaire, tension sociale, confiance
   institutionnelle.
4. **International** (`world.ts` intégré à l'économie) — dérive des relations,
   coûts de guerre, effet drapeau.
5. **Événements** (`events.ts`) — sélection des événements éligibles ; les choix
   sont faits par le joueur (UI) ou une stratégie (simulation).
6. **Actions du joueur** — dépense de **capital politique** et de **points
   d'action** (temps) sur des mesures/pouvoirs.
7. **Résolution & bilan** — application des effets immédiats, calcul des
   réactions, journal des décisions, snapshot d'historique.
8. **Victoire / défaite** (`victory.ts`) — vérifiée à chaque tour.

L'ordre réel dans l'UI : *dépêches → événement(s) → actions → « Terminer le
trimestre » → bilan*. Dans le moteur, `applyMeasure`/`resolveEventChoice`
mutent une copie de l'état pendant la phase d'action, puis `endTurn` déclenche
macro + opinion + events du tour suivant.

### 2.3 Budgets par tour
- **Capital politique** (`capital`, 0-100) : régénéré chaque trimestre
  (`+baseRegen * f(popularité)`), dépensé par les mesures « coûteuses » et les
  pouvoirs constitutionnels. À 0, plus rien de lourd n'est possible.
- **Points d'action** (`actionPoints`, ex. 3/tour) : le *temps* présidentiel.
  Chaque mesure en coûte 1 à 3. Remis à plein chaque tour.

---

## 3. Jauges et variables d'état

Toutes les jauges de type « indice » sont **bornées [0,100]** et clampées à
chaque écriture (`clamp01x100`). Les grandeurs économiques ont leurs propres
bornes réalistes.

### 3.1 Finances publiques (`state.macro`)
| Champ | Unité | Départ | Note |
|---|---|---|---|
| `pib` | Md€ nominal | 2966 | PIB France ~3 000 Md€ |
| `deficitPct` | % PIB (déficit>0) | 5.9 | point de départ |
| `debt` | Md€ | 3500 | ~118 % du PIB |
| `debtPct` | % PIB (calculé) | 118.0 | `debt/pib*100` |
| `primaryBalancePct` | % PIB (solde primaire) | −3.66 | hors intérêts |
| `marketRate` | % (OAT 10 ans) | 3.3 | taux de marché |
| `apparentRate` | % (taux moyen du stock) | 1.9 | converge vers marché |
| `interestCharge` | Md€/an (calculé) | ~66.5 | `apparentRate*debt/100` |
| `spread` | points de base vs Bund | 60 | risque souverain |
| `mandatoryLevies` | % PIB | 43.5 | prélèvements obligatoires |
| `ratings` | notch S&P/Moody's/Fitch | AA−/AA−/AA− | indice 0-21 → label |

### 3.2 Économie (`state.economy`, indices 0-100 sauf indiqué)
`growth` (% annuel réel, départ 0.8), `unemployment` (%, départ 7.5),
`inflation` (%, départ 2.4), `purchasingPower` (indice, 50), `competitiveness`
(48), `investment` (50), `tradeBalance` (% PIB, −1.8), `inequality` (indice, 55
= plutôt inégal), `businessConfidence` (52).

### 3.3 Politique intérieure (`state.politics`)
- `popularity` (0-100, global, calculé depuis les groupes).
- `groups` : approbation 0-100 pour `jeunes, retraites, classesMoyennes,
  classesPopulaires, cadres, agriculteurs, fonctionnaires, patrons, banlieues,
  ruralite`.
- `capital` (0-100), `actionPoints`.
- `assembly` : sièges + soutien (0-100) par **groupe parlementaire fictif** →
  calcul d'une **majorité** et d'un **risque de censure**.
- `pmRelation`, `ministerMorale` (0-100) ; un ministre à moral bas peut
  démissionner (événement).
- `socialTension` (0-100), `institutionalTrust` (0-100).
- `cohabitation` (bool) : si une majorité adverse gouverne, les pouvoirs
  intérieurs du joueur chutent (voir §7).

### 3.4 Société / long terme (`state.society`, indices 0-100)
`sante, education, securite, justice, ecologie, energie, demographie,
immigrationPressure, logement, cohesion`.

### 3.5 International (`state.intl`)
`reputation` (0-100), `europeWeight` (0-100), `armyStrength` (0-100),
`armyMorale` (0-100), `ammoStock` (0-100), `deterrence` (0-100, stable/élevé),
`atWar` (liste de théâtres actifs), et `relations` : indice −100..+100 par pays
(États-Unis, Allemagne, Royaume-Uni, Italie, Espagne, Pologne, Russie, Chine,
Ukraine, Inde, Turquie, Algérie/Maghreb, Sahel, Moyen-Orient…).

### 3.6 Méta (`state.meta`)
`turn`, `date` (année, mois, libellé trimestre), `phase`, `seed`, `rngState`,
`profile`, `difficulty`, `mode`, `mandat` (1 ou 2), `promises` (mesures promises
en campagne), `flags` (set d'étiquettes narratives), `history` (snapshots),
`journal` (décisions), `achievements`, `pendingEffects`, `advisorBiasSeed`.

---

## 4. Formules d'impact (moteur)

Notations : `Δx` = variation appliquée ce trimestre ; les taux annuels sont
divisés par 4 pour le pas trimestriel quand nécessaire. `clamp(x,a,b)`.

### 4.1 Croissance (annualisée, mise à jour trimestrielle)
```
impulsionBudgetaire = ΔprimaryBalancePct(sur l'année) // >0 = consolidation
growthTarget = trendGrowth
             + 0.08*(businessConfidence-50)/10          // confiance
             + 0.06*(investment-50)/10                   // investissement
             - fiscalMultiplier * impulsionBudgetaire     // austérité pèse
             + 0.05*(competitiveness-50)/10
             - shockDrag                                  // chocs (events)
growth += (growthTarget - growth) * 0.5   // lissage (inertie)
growth = clamp(growth, -6, 6)
```
`fiscalMultiplier ≈ 0.5` (une consolidation de 1 pt de PIB coûte ~0.5 pt de
croissance la première année ; ordre de grandeur des multiplicateurs bas de
cycle). `trendGrowth ≈ 1.0`, réduit par démographie/vieillissement.

### 4.2 Chômage (loi d'Okun simplifiée)
```
unemployment += -0.30*(growth - potentialGrowth) + laborReformEffect
unemployment = clamp(unemployment, 2.5, 16)
```
`potentialGrowth ≈ 1.1`.

### 4.3 Inflation
```
inflation += 0.15*(energyShock) + 0.10*(growth-potential) - 0.10*(rateGap) + drift
inflation = clamp(inflation, -1, 12)
```
Monétisation / « inflation choisie » ajoute un terme ; la BCE réagit via
`marketRate`.

### 4.4 Taux, spread, charge de la dette
```
spread += 4*(debtPct-115)/10        // dérive avec l'endettement relatif
        + 3*max(0, deficitPct-3)    // au-dessus de 3 % Bruxelles/marchés tiquent
        + politicalRiskPremium       // instabilité, monétisation, censure
        - creditReformEffect
spread = clamp(spread, -20, 700)
marketRate = baseBund + spread/100   // baseBund ~2.5 %
apparentRate += (marketRate - apparentRate) * rolloverShare   // ~1/28 par trimestre
interestCharge = apparentRate/100 * debt
```
`politicalRiskPremium` monte avec `socialTension`, une censure, la
monétisation ; une notation dégradée ajoute ~20-40 bps par cran.

### 4.5 Déficit et dette
```
cyclicalRevenue = 0.5*(growth - potentialGrowth)         // stabilisateurs
deficitPct = -primaryBalancePct + interestCharge/pib*100 - cyclicalRevenue - measureRevenuePct
// (measureRevenuePct : effet direct des mesures fiscales/économies sur le solde)
deficitPct = clamp(deficitPct, -4, 14)   // -4 = excédent, 14 = dérapage
debt += deficitPct/100 * pib / 4          // pas trimestriel
debt += oneOffDebtDelta                    // privatisations (−), reprises (+)
pib *= (1 + (growth/100)/4 + (inflation/100)/4)   // PIB nominal
debtPct = debt/pib*100
```

### 4.6 Notations souveraines
Indice 0 (D) … 21 (AAA). Recalcul avec **hystérésis** (ne bouge pas chaque
trimestre) : un score `creditScore` agrège `debtPct` (−), `deficitPct` (−),
`growth` (+), `politicalStability` (+), `spread` (−). Si `creditScore` franchit
un seuil pendant ≥2 trimestres, l'agence dégrade/relève d'un cran. Une
dégradation renchérit le spread et déclenche une dépêche.

### 4.7 Opinion
Pour chaque groupe `g`, cible d'approbation :
```
approvalTarget[g] = 50
  + wPP[g]*(purchasingPower-50)/5
  - wUnemp[g]*(unemployment-7)*2
  - wInfl[g]*(inflation-2)*2
  + measureOpinion[g]     // somme des effets d'opinion des mesures récentes (déclin)
  - 0.3*socialTension
  + profileCharismaBonus
approval[g] += (approvalTarget[g]-approval[g]) * 0.4    // inertie de l'opinion
popularity = Σ poids[g]*approval[g]
```
Les poids `w*[g]` encodent la sociologie (les retraités sensibles aux pensions
et à la sécurité ; les patrons à l'IS et au coût du travail ; etc.). Les effets
de mesures s'estompent (`measureOpinion *= 0.7` par tour).

### 4.8 Capital politique
```
capital += baseRegen(profile,difficulty) + 0.1*(popularity-50)
         - censureShock - scandalCost
capital = clamp(capital, 0, 100)
```

### 4.9 Assemblée & censure
Chaque groupe parlementaire a `seats` et `support` (0-100). Une mesure a un
`assemblyEffect` par famille. La **majorité de soutien** =
`Σ seats*(support>50)`. **Risque de censure** monte quand une mesure clivante
passe en force (49.3), quand `support` global < seuil, quand la tension sociale
est haute. Une motion de censure adoptée ⇒ chute du gouvernement (événement :
nouveau PM, perte de capital) ; répétée ⇒ **défaite « blocage »**.

### 4.10 Effets différés
`PendingEffect = { dueTurn, patch }`. `applyMeasure` peut pousser des effets à
`turn+k`. Le moteur applique et purge la file au début de chaque tour. Sert aux
réformes structurelles (retraites → recettes dans 12-20 tours), lois de
programmation, investissements.

---

## 5. Modèle électoral (`elections.ts`)

### 5.1 Candidats
5 à 8 candidats fictifs placés sur des axes : `econLeftRight` (−1..+1),
`socialLibAuth` (−1..+1), `proEU` (−1..+1), `family` (famille politique). Chacun
a un `baseFloor` (socle électoral de sa famille) et une `quality`.

### 5.2 Premier tour
Pour chaque candidat, un **attrait** :
```
appeal = baseFloor
       + moodMatch(mood, position)         // l'humeur nationale favorise un axe
       + incumbentEffect (pour le sortant : ±selon popularité, usure)
       + campaignBonus (meetings, débats, promesses, affaires)
       + rng(±bruit)
```
Parts du 1er tour = `softmax(appeal)` renormalisé, moins l'**abstention**
(fonction de la défiance et de la cohésion). Les deux premiers passent au 2d.

### 5.3 Second tour
Matrice de **reports** : les électeurs d'un candidat éliminé se reportent selon
la proximité idéologique, le « front républicain » éventuel, le vote sanction
anti-sortant et l'abstention différentielle. Score final normalisé sur les
suffrages exprimés.

### 5.4 Législatives & cohabitation
Après une présidentielle (ou une dissolution), des législatives redistribuent
les sièges de l'Assemblée à partir de l'humeur nationale et du résultat
présidentiel. Si le camp du Président n'a pas la majorité et qu'un camp adverse
l'a, `cohabitation=true` : le PM adverse pilote la politique intérieure
(mesures intérieures grisées / effet réduit), le Président garde le domaine
réservé (diplomatie, défense). Sortie de cohabitation via dissolution ou
nouvelle élection.

---

## 6. Conditions de victoire / défaite (`victory.ts`)

**Défaites** (déclenchent `phase=FIN`) :
- Popularité < 15 pendant 3 tours **et** capital < 10 → démission forcée.
- 2 censures dans le mandat sans dissolution → blocage total.
- Défaite à la présidentielle (mode campagne/complet).
- `debtPct` > 150 **ou** `spread` > 600 pendant 2 tours → crise de la dette,
  tutelle FMI/UE.
- Guerre perdue (théâtre majeur, `armyMorale` effondré) → défaite militaire.
- `socialTension` > 92 pendant 2 tours → troubles civils incontrôlables.
- Événements rares : destitution, coup de force.

**Victoires** (plusieurs niveaux, score final) :
- Réélection en 2027.
- `deficitPct` < 3 avant 2030.
- `debtPct` en baisse continue avant 2032.
- Mandat achevé (bilan « historique » selon score).
- Objectifs secondaires : plein-emploi (`unemployment<5`), transition
  (`ecologie>70`), réforme des institutions, paix.

**Score final** : moyenne pondérée normalisée (finances, économie, social,
international, cohésion) + bonus objectifs, → **note A+…F** et texte de bilan
« façon manuel d'histoire ».

---

## 7. Pouvoirs présidentiels (contraintes réelles simplifiées)

- **Nommer/révoquer le PM**, remanier : reset partiel du soutien, coût capital.
- **Dissolution (art. 12)** : déclenche des législatives ; peut donner une
  majorité *ou* une cohabitation. Non renouvelable dans l'année.
- **Référendum (art. 11)** : sur un thème éligible ; gain de légitimité si gagné,
  choc si perdu.
- **49.3** (via gouvernement) : fait passer un texte sans vote mais **arme la
  censure** et coûte de la tension sociale et du soutien.
- **Art. 16** (pouvoirs exceptionnels) : réservé aux crises graves ; énorme
  risque institutionnel (chute de `institutionalTrust`).
- **Grâce, nominations, ordonnances, message au Parlement, saisine du Conseil
  constitutionnel** : effets ciblés.
- En **cohabitation**, les leviers `domain=interieur/budget` sont bridés
  (effet ×0.3, capital ×2), le domaine réservé reste plein.

---

## 8. Structure des données

### 8.1 `Measure`
```ts
type Measure = {
  id: string; titre: string; domaine: Domaine; famille: Famille;
  description: string;            // info-bulle pédagogique : ce que ça fait vraiment
  cout: { capital: number; actionPoints: number };
  delaiTours?: number;            // 0 = immédiat ; sinon effet principal différé
  effets: Effet;                  // patch immédiat sur l'état
  effetsDiffered?: Effet;         // patch appliqué à turn+delaiTours
  opinion?: Partial<Record<Group, number>>;
  assemblee?: Partial<Record<Famille, number>>;
  budgetImpactMdEUR?: number;     // + = économie/recette ; − = dépense
  budgetImpactLongMdEUR?: number; // effet différé sur le solde
  croissanceImpact?: number;      // pts de croissance (différé/immédiat)
  risques?: string[];
  conditions?: Condition;         // éligibilité
  oneShot?: boolean;              // non répétable
  tags?: string[];
  source_ou_ordre_de_grandeur: string;   // OBLIGATOIRE
};
```

### 8.2 `GameEvent`
```ts
type GameEvent = {
  id: string; titre: string; categorie: Categorie; texte: string;
  poids: number;                       // probabilité relative
  conditions?: Condition;              // déclenchement conditionné à l'état
  choix: EventChoice[];                // arbre de décision
  chaine?: string;                     // id de chaîne narrative
  oneShot?: boolean;
  source_ou_ordre_de_grandeur: string;
};
type EventChoice = {
  label: string; effets: Effet; opinion?: ...; suite?: string; // event suivant
  cout?: { capital?: number };
  source_ou_ordre_de_grandeur?: string;
};
```

`Effet` est un patch partiel et *additif* sur les champs numériques de l'état
(macro/economy/politics/society/intl), plus des drapeaux. `applyEffet`
additionne puis clampe. `Condition` est une petite expression déclarative
(`{ champ, op, valeur }` combinables par `all`/`any`).

### 8.3 Autres jeux de données
`profiles.ts` (5 profils : technocrate, tribun, réformateur, souverainiste,
écologiste — bonus/malus sur capital, groupes, familles), `characters.ts`
(PM, ministres, chefs de parti fictifs, candidats, conseillers avec un
**biais**), `countries.ts` (relations initiales), `achievements.ts`.

---

## 9. Architecture logicielle

```
president2027/
  DESIGN.md  BALANCE.md  README.md
  package.json  tsconfig.json  vite.config.ts  netlify.toml  index.html
  src/
    engine/   rng, types, constants, state, effects, economy, opinion,
              events, measures, elections, victory, engine, index
    data/     profiles, measures, events, characters, countries, achievements
    sim/      strategies, run
    ui/       main, dom, charts, styles.css
    engine/*.test.ts   (tests node:test)
```
- **Moteur pur** : aucune importation UI/DOM.
- **Aléa** : `rng.ts` (`mulberry32`), état sérialisé dans la partie.
- **Exécution sans build** : Node 22 exécute les `.ts` (type-stripping) → tests
  (`node --test`) et simulation (`node src/sim/run.ts`) sans dépendance.
- **App** : Vite + TS → `dist/` statique pour Netlify. Imports en `.ts` explicites
  (Node natif + `allowImportingTsExtensions`).

---

## 10. Plan de test

**Tests unitaires (`node --test`)**
1. **Déterminisme** : deux parties, même graine + mêmes actions ⇒ états
   identiques (hash d'état) ; RNG reproductible.
2. **Bornes** : après application d'effets extrêmes, toutes les jauges 0-100
   restent dans [0,100] ; grandeurs éco dans leurs bornes.
3. **Économie** : austérité ⇒ déficit baisse mais croissance baisse ; hausse de
   taux ⇒ charge de la dette monte ; dette évolue de façon cohérente.
4. **Opinion** : mesure impopulaire ⇒ groupe visé baisse ; inflation ⇒
   popularité baisse.
5. **Élections** : reproductibles à graine fixe ; parts somment ~100 % ; 2d tour
   n'a que 2 candidats ; reports plausibles.
6. **Victoire/défaite** : états construits déclenchent la bonne fin (dette>150,
   popularité effondrée, réélection, déficit<3).
7. **Mesures/événements** : intégrité des données (ids uniques, champ
   `source_ou_ordre_de_grandeur` présent, conditions valides).

**Équilibrage (`node src/sim/run.ts`, → `BALANCE.md`)**
1 000 parties × 4 stratégies (aléatoire, prudente, dépensière, belliciste) + une
stratégie « réfléchie ». Cibles : aucune stratégie ne gagne systématiquement ;
la stratégie réfléchie gagne **10-20 %** ; distribution des fins variée.

---

## 11. Limites assumées
Modèle macro très simplifié (pas de vraie comptabilité nationale), personnages
et partis **fictifs**, chiffres en **ordres de grandeur** signalés, pas une
prédiction. L'écran « À propos » le rappelle en jeu.
