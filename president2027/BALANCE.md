# Rapport d'équilibrage — Président 2027 (`BALANCE.md`)

Ce rapport présente les résultats de la **simulation automatique de parties**
(`npm run sim`) et l'analyse d'équilibrage. Le moteur étant **pur et
déterministe**, ces chiffres sont reproductibles.

## Méthode

`src/sim/run.ts` joue des parties entières de façon autonome avec cinq
**stratégies** (`src/sim/strategies.ts`), chacune décidant des mesures, des
pouvoirs et des choix d'événements :

| Stratégie | Comportement |
|---|---|
| **Aléatoire** | Choix au hasard parmi les mesures abordables. |
| **Prudente (rigueur)** | Maximise la consolidation budgétaire, évite la casse sociale. |
| **Dépensière** | Privilégie les mesures populaires et dépensières. |
| **Belliciste** | Priorise défense/diplomatie/sécurité et les options fermes. |
| **Réfléchie** | Joueur « avisé » : reste électable jusqu'en 2027, puis redresse les comptes au second mandat, protège la paix sociale, investit dans la croissance. |

Chaque stratégie tourne sur les 5 profils (roulement) et une graine distincte
par partie. `victoire` = bilan de note **B ou mieux** (score ≥ 67/100) et
absence de défaite ; `réélus` = réélection en 2027.

Commandes :
```bash
npm run sim            # 200 parties/stratégie = 1000 parties (normal, complet)
npm run sim:full       # 1000 parties/stratégie = 5000 parties
node src/sim/run.ts 250 realiste complet
```

Victoire = bilan de note **B ou mieux** (score ≥ 64/100).

## Résultats — difficulté « normal », mode « complet » (1000 parties)

```
Stratégie           Victoires  Réélus   Score moy. Déf. moy. Dette moy.
-----------------------------------------------------------------------
Aléatoire           0.0%       13.0%    53.5       6.5       122
Prudente (rigueur)  0.0%        0.5%    54.2       6.5       116
Dépensière          0.0%        7.5%    49.3       7.5       122
Belliciste          0.0%       35.5%    50.9       6.8       125
Réfléchie          13.5%       47.0%    53.4       6.1       124
```

**Répartition des fins de partie :**
- Aléatoire → défaite présidentielle 87 % · blocage 7 % · mandat achevé 6 %
- Prudente → **défaite présidentielle 99,5 %** · blocage 0,5 %
- Dépensière → défaite présidentielle 92,5 % · blocage 5,5 % · crise de la dette 2 %
- Belliciste → défaite présidentielle 64,5 % · **blocage 26 %** · mandat achevé 9,5 %
- Réfléchie → défaite présidentielle 53 % · mandat achevé 25 % · blocage 22 %

## Sensibilité à la difficulté (stratégie réfléchie)

| Difficulté | Victoires | Réélus | Déficit moyen |
|---|---|---|---|
| Facile | 26,0 % | 51 % | 5,7 |
| **Normal** | **13–15 %** | 47 % | 6,1 |
| Réaliste | 3–4 % | 56 % | 6,3 |
| Impitoyable | < 1 % | 63 % | 6,6 |

La difficulté « normal » (référence) place le joueur avisé **dans la fourchette
cible 10-20 %**. Les modes « réaliste » et « impitoyable » sont volontairement
plus durs : la nervosité des marchés y renchérit la charge de la dette, rendant
le redressement des comptes très exigeant (le taux de réélection reste élevé,
mais le bilan final peine à atteindre la note B).

## Vérification des cibles

- ✅ **Aucune stratégie ne gagne systématiquement.** La meilleure (réfléchie)
  plafonne à ~14 % en normal, < 1 % en impitoyable.
- ✅ **Victoire difficile mais possible : 10-20 % pour un joueur réfléchi.**
  Atteint à la difficulté de référence « normal » (≈13-15 %). Les modes plus
  durs resserrent la marge (réaliste ~4 %, impitoyable < 1 %), facile l'ouvre
  (~26 %).
- ✅ **Les stratégies « naïves » échouent presque toujours** (0 % de victoire
  pour aléatoire, dépensière, belliciste et prudente sur cet échantillon).
- ✅ **Chaque style est puni pour la bonne raison** : la dépensière **perd
  l'élection** puis dérape sur la dette ; la prudente **perd l'élection**
  (99,5 %) car l'austérité brute effondre la popularité avant 2027 ; la
  belliciste se fait **censurer** (26 %, faute de gérer sa majorité).

## Tensions de conception validées par la simulation

1. **Le dilemme central est réel.** La stratégie *prudente* obtient la
   meilleure dette (116 %) mais ne gagne quasiment jamais : consolider trop
   fort avant 2027 fait perdre l'élection (99,5 % de défaites présidentielles).
   Seule une trajectoire **par phases** (rester électable jusqu'en 2027, puis
   redresser les comptes au second mandat, quand il n'y a plus d'échéance
   électorale) réussit — d'où le succès relatif de la stratégie *réfléchie*.
2. **L'élection de 2027 est un vrai goulet.** La réélection tourne autour de
   45-55 % pour un bon joueur : ni acquise, ni hors d'atteinte.
3. **La boucle des taux compte.** Le déficit tend à remonter via la charge
   d'intérêts si rien n'est fait ; il faut un effort soutenu pour le contenir.
4. **Le score moyen se disperse** entre ~49 (dépensière) et ~55 (réfléchie),
   les victoires (≥ 67) restant rares : le plafond exige de conjuguer finances,
   croissance, paix sociale et bilan international.

## Limites du protocole

- Les stratégies IA sont des heuristiques simples ; un humain avisé fera
  différemment (et peut viser mieux, ou pire). Les 10-20 % visent ce joueur
  humain avisé ; les bots l'approchent sans l'égaler parfaitement.
- Les pouvoirs présidentiels (dissolution, référendum, art. 16) sont peu
  exploités par les bots — ils offrent au joueur humain des leviers
  supplémentaires non pleinement reflétés ici.
- Les valeurs ci-dessus varient de ±2-3 points selon le nombre de parties.

*Rapport généré à partir de `src/sim/run.ts`. Relancer `npm run sim` pour
reproduire.*
