import {
  type GameState, type Measure, MEASURES, POWERS, measureAvailability, applyMeasure,
  usePower, majoriteSoutien, risqueCensure, MAJORITE_ABSOLUE,
} from '../engine/index.ts';
import type { Rng } from '../engine/rng.ts';

export type Strategy = {
  nom: string;
  /** Choisit l'indice d'un choix d'événement parmi ceux disponibles. */
  chooseEvent: (s: GameState, choices: number[], rng: Rng) => number;
  /** Phase d'action : applique mesures/pouvoirs tant qu'il reste des moyens. */
  act: (s: GameState, rng: Rng) => void;
};

function affordable(s: GameState): Measure[] {
  return MEASURES.filter((m) => !m.pouvoir && measureAvailability(s, m).ok);
}

/** Somme des gains budgétaires immédiats + différés d'une mesure. */
function budgetScore(m: Measure): number {
  let b = m.effets?.budgetMdEUR ?? 0;
  b += (m.effetsDiffered?.budgetMdEUR ?? 0) * 0.7;
  b += (m.effets?.primaryBalancePct ?? 0) * 30;
  b += (m.effets?.debtOneOff ?? 0) * -0.1;
  return b;
}
function opinionScore(m: Measure): number {
  const g = m.effets?.groups ?? {};
  let sum = 0; for (const k in g) sum += (g as any)[k];
  sum += (m.effets?.politics?.socialTension ?? 0) * -0.5;
  return sum;
}

function applyBest(s: GameState, rng: Rng, score: (m: Measure) => number, maxActions = 3): void {
  let guard = 0;
  while (s.politics.actionPoints > 0 && guard++ < maxActions) {
    const pool = affordable(s);
    if (pool.length === 0) break;
    // trie par score décroissant, avec un peu de bruit pour la diversité
    pool.sort((a, b) => score(b) - score(a) + (rng.next() - 0.5) * 4);
    const m = pool[0];
    if (score(m) <= -999) break;
    applyMeasure(s, m);
  }
}

/** Gère la majorité : nomme un PM d'ouverture si le risque de censure est fort. */
function manageMajority(s: GameState, rng: Rng): void {
  if (!s.politics.cohabitation && majoriteSoutien(s) < MAJORITE_ABSOLUE - 40 && risqueCensure(s) > 55) {
    const pm = POWERS.find((p) => p.id === 'pouv_pm_ouverture');
    if (pm && s.politics.capital >= pm.coutCapital && s.politics.actionPoints >= pm.coutActionPoints) {
      usePower(s, 'pouv_pm_ouverture');
    }
  }
}

// --------------------------- Stratégies ------------------------------------

export const RANDOM: Strategy = {
  nom: 'Aléatoire',
  chooseEvent: (_s, choices, rng) => choices[Math.floor(rng.next() * choices.length)],
  act: (s, rng) => {
    let guard = 0;
    while (s.politics.actionPoints > 0 && guard++ < 4 && rng.next() < 0.8) {
      const pool = affordable(s);
      if (pool.length === 0) break;
      applyMeasure(s, pool[Math.floor(rng.next() * pool.length)]);
    }
    if (rng.next() < 0.05) {
      const p = POWERS[Math.floor(rng.next() * POWERS.length)];
      usePower(s, p.id);
    }
  },
};

export const PRUDENTE: Strategy = {
  nom: 'Prudente (rigueur)',
  chooseEvent: (s, choices) => {
    // préfère le choix le moins coûteux / le plus rassembleur (heuristique : index 0)
    return choices[0];
  },
  act: (s, rng) => {
    manageMajority(s, rng);
    // Priorité : réduire le déficit sans trop de casse sociale.
    applyBest(s, rng, (m) => budgetScore(m) * 1.4 - Math.max(0, (m.effets?.politics?.socialTension ?? 0)) * 1.5
      - Math.max(0, -opinionScore(m)) * 0.2);
  },
};

export const DEPENSIERE: Strategy = {
  nom: 'Dépensière',
  chooseEvent: (s, choices) => choices[choices.length - 1],
  act: (s, rng) => {
    applyBest(s, rng, (m) => opinionScore(m) * 1.2 - budgetScore(m) * 0.3);
  },
};

export const BELLICISTE: Strategy = {
  nom: 'Belliciste',
  chooseEvent: (s, choices, rng) => {
    // tend à choisir les options les plus fermes (souvent la dernière/du milieu)
    return choices[Math.min(choices.length - 1, Math.floor(choices.length / 2) + 1)] ?? choices[0];
  },
  act: (s, rng) => {
    manageMajority(s, rng);
    applyBest(s, rng, (m) => {
      const def = ['defense', 'diplomatie', 'securite'].includes(m.domaine) ? 30 : 0;
      return def + budgetScore(m) * 0.3 + opinionScore(m) * 0.2;
    });
  },
};

export const REFLECHIE: Strategy = {
  nom: 'Réfléchie',
  chooseEvent: (s, choices, rng) => {
    // évite les options extrêmes, préfère l'apaisement quand la tension est haute
    if (s.politics.socialTension > 65) return choices[0];
    return choices[Math.min(1, choices.length - 1)];
  },
  act: (s, rng) => {
    manageMajority(s, rng);
    const campagne = s.meta.phase === 'CAMPAGNE';
    // Avant 2027 : élection en vue -> il faut rester électable.
    // Après réélection (mandat 2) : plus d'élection -> on peut consolider dur.
    const electionAhead = s.meta.mandat < 2;
    const deficitHigh = s.macro.deficitPct > 4;
    const debtHigh = s.macro.debtPct > 118;
    const unpopular = s.politics.popularity < 46;
    const tensionHigh = s.politics.socialTension > 62;

    applyBest(s, rng, (m) => {
      let sc = 0;
      const tension = Math.max(0, (m.effets?.politics?.socialTension ?? 0));
      const budget = budgetScore(m);
      const growth = (m.effets?.growthShock ?? 0) * 10 + (m.effetsDiffered?.growthShock ?? 0) * 8
        + ((m.effetsDiffered?.economy?.competitiveness ?? 0) + (m.effetsDiffered?.economy?.investment ?? 0)
        + (m.effets?.economy?.competitiveness ?? 0)) * 2;
      const soc = m.effetsDiffered?.society ?? m.effets?.society ?? {};
      let socSum = 0; for (const k in soc) socSum += (soc as any)[k];

      if (campagne) {
        // Priorité absolue : plaire, sans casse sociale.
        sc += opinionScore(m) * 1.6 + budget * 0.2 - tension * 2;
      } else if (electionAhead) {
        // Mandat 1 : consolider un peu, mais préserver la popularité pour 2027.
        sc += budget * (deficitHigh ? 0.8 : 0.4) + growth + socSum * 0.5
          + opinionScore(m) * (unpopular ? 0.9 : 0.35) - tension * 1.8;
      } else {
        // Mandat 2 : redressement des comptes prioritaire (plus d'élection).
        sc += budget * (deficitHigh || debtHigh ? 1.9 : 1.1) + growth * 0.8 + socSum * 0.5;
        if (tensionHigh && (m.effets?.politics?.socialTension ?? 0) < 0) sc += 16;
        sc -= tension * (tensionHigh ? 2.2 : 0.7);
      }
      return sc;
    }, 6);
    if (campagne) s.meta.campaignActions += 1;
  },
};

export const STRATEGIES: Record<string, Strategy> = {
  aleatoire: RANDOM, prudente: PRUDENTE, depensiere: DEPENSIERE, belliciste: BELLICISTE, reflechie: REFLECHIE,
};
