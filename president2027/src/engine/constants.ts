import type { Group, Famille, Difficulty } from './types.ts';

// ---------------------------------------------------------------------------
// Point de départ (automne 2026). Ordres de grandeur réalistes — voir DESIGN.md.
// ---------------------------------------------------------------------------
export const START = {
  pib: 2966,            // Md€ nominal (PIB France ~3 000 Md€)
  deficitPct: 5.9,      // % PIB
  debt: 3500,           // Md€ (~118 % du PIB)
  primaryBalancePct: -3.66,
  marketRate: 3.3,      // OAT 10 ans
  apparentRate: 1.9,    // taux moyen du stock
  spread: 60,           // bps vs Bund
  mandatoryLevies: 43.5,
  baseBund: 2.5,        // taux allemand de référence
  trendGrowth: 1.0,
  potentialGrowth: 1.1,
};

// Bornes des grandeurs économiques.
export const BOUNDS = {
  growth: [-6, 6],
  unemployment: [2.5, 16],
  inflation: [-1, 12],
  deficitPct: [-4, 14],
  spread: [-20, 700],
  tradeBalance: [-8, 6],
  marketRate: [0, 12],
  apparentRate: [0, 10],
  mandatoryLevies: [30, 55],
} as const;

// Notations : indice 0 (D) -> 21 (AAA).
export const RATING_LABELS = [
  'D', 'C', 'CC', 'CCC-', 'CCC', 'CCC+', 'B-', 'B', 'B+', 'BB-', 'BB', 'BB+',
  'BBB-', 'BBB', 'BBB+', 'A-', 'A', 'A+', 'AA-', 'AA', 'AA+', 'AAA',
];
export const START_RATING = 18; // AA-

export function ratingLabel(idx: number): string {
  const i = Math.max(0, Math.min(RATING_LABELS.length - 1, Math.round(idx)));
  return RATING_LABELS[i];
}

// ---------------------------------------------------------------------------
// Réglages par difficulté.
// ---------------------------------------------------------------------------
export type DiffConfig = {
  capitalRegen: number;      // régénération de base du capital / tour
  startCapital: number;
  eventSeverity: number;     // multiplicateur d'intensité des chocs
  marketNervousness: number; // sensibilité du spread
  opinionInertia: number;    // 0-1, plus haut = opinion plus stable
  actionPoints: number;
};

export const DIFFICULTY: Record<Difficulty, DiffConfig> = {
  facile:      { capitalRegen: 22, startCapital: 60, eventSeverity: 0.6, marketNervousness: 0.7, opinionInertia: 0.5, actionPoints: 4 },
  normal:      { capitalRegen: 18, startCapital: 50, eventSeverity: 1.0, marketNervousness: 1.0, opinionInertia: 0.42, actionPoints: 3 },
  realiste:    { capitalRegen: 15, startCapital: 42, eventSeverity: 1.25, marketNervousness: 1.25, opinionInertia: 0.4, actionPoints: 3 },
  impitoyable: { capitalRegen: 12, startCapital: 35, eventSeverity: 1.6, marketNervousness: 1.6, opinionInertia: 0.36, actionPoints: 3 },
};

// ---------------------------------------------------------------------------
// Poids sociologiques : comment chaque groupe compte dans la popularité,
// et sa sensibilité au pouvoir d'achat / chômage / inflation.
// ---------------------------------------------------------------------------
export const GROUP_WEIGHT: Record<Group, number> = {
  jeunes: 0.10, retraites: 0.16, classesMoyennes: 0.16, classesPopulaires: 0.14,
  cadres: 0.10, agriculteurs: 0.05, fonctionnaires: 0.09, patrons: 0.06,
  banlieues: 0.06, ruralite: 0.08,
};

export const GROUP_SENS: Record<Group, { pp: number; unemp: number; infl: number }> = {
  jeunes:            { pp: 1.0, unemp: 1.4, infl: 0.8 },
  retraites:         { pp: 1.2, unemp: 0.3, infl: 1.4 },
  classesMoyennes:   { pp: 1.3, unemp: 1.0, infl: 1.2 },
  classesPopulaires: { pp: 1.5, unemp: 1.3, infl: 1.5 },
  cadres:            { pp: 0.8, unemp: 0.7, infl: 0.7 },
  agriculteurs:      { pp: 1.1, unemp: 0.6, infl: 1.0 },
  fonctionnaires:    { pp: 1.2, unemp: 0.4, infl: 1.1 },
  patrons:           { pp: 0.6, unemp: 0.9, infl: 0.9 },
  banlieues:         { pp: 1.3, unemp: 1.4, infl: 1.2 },
  ruralite:          { pp: 1.1, unemp: 1.0, infl: 1.2 },
};

// Sièges initiaux à l'Assemblée (Assemblée sans majorité claire). Total = 577.
export const START_SEATS: Record<Famille, number> = {
  gaucheRadicale: 72,
  gaucheSociale: 66,
  ecologistes: 33,
  centre: 168,        // camp présidentiel (relatif, pas majoritaire)
  droite: 62,
  droiteNationale: 176,
};
export const MAJORITE_ABSOLUE = 289;

// Soutien parlementaire initial au Président (0-100).
export const START_SUPPORT: Record<Famille, number> = {
  gaucheRadicale: 12,
  gaucheSociale: 34,
  ecologistes: 30,
  centre: 82,
  droite: 46,
  droiteNationale: 18,
};

// Proximité idéologique entre familles (0 = identique, 1 = opposé). Sert aux
// reports de voix et au calcul du soutien parlementaire.
export const FAMILLE_AXE: Record<Famille, number> = {
  gaucheRadicale: -1.0,
  gaucheSociale: -0.5,
  ecologistes: -0.35,
  centre: 0.0,
  droite: 0.55,
  droiteNationale: 1.0,
};

export function clamp(x: number, a: number, b: number): number {
  return x < a ? a : x > b ? b : x;
}
export function clamp01x100(x: number): number {
  return clamp(x, 0, 100);
}
export function round1(x: number): number {
  return Math.round(x * 10) / 10;
}
