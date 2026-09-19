import type { GameState, Measure } from './types.ts';
import { START, clamp } from './constants.ts';

// Aperçus « en direct » pour l'interface : ce que deviendra le déficit au
// prochain trimestre, l'impact d'une mesure avant de la valider, et le solde
// des décisions déjà prises ce trimestre. Fonctions pures (aucune mutation).

const COHAB_RESTRICTED = new Set([
  'budget', 'fiscalite', 'social', 'dette', 'interieur', 'energie', 'ecologie',
  'education', 'sante', 'securite', 'justice', 'immigration', 'economie',
]);

/** Déficit projeté au prochain trimestre à partir de l'état courant (% PIB). */
export function projectedDeficit(s: GameState): number {
  const m = s.macro;
  const interestPct = (m.interestCharge / m.pib) * 100;
  const cyclicalRevenue = 0.5 * (s.economy.growth - START.potentialGrowth);
  return clamp(-m.primaryBalancePct + interestPct - cyclicalRevenue, -4, 14);
}

/**
 * Variation du déficit projeté qu'apporterait une mesure (points de PIB).
 * Négatif = la mesure RÉDUIT le déficit. Tient compte de la cohabitation.
 */
export function measureDeficitDelta(s: GameState, mm: Measure): number {
  const factor = s.politics.cohabitation && COHAB_RESTRICTED.has(mm.domaine) ? 0.3 : 1;
  const budget = mm.effets?.budgetMdEUR ?? 0;
  const pb = mm.effets?.primaryBalancePct ?? 0;
  const primaryAdd = (budget / s.macro.pib) * 100 + pb;
  return -primaryAdd * factor;
}

/** Impact budgétaire direct d'une mesure (Md€/an, + = économie/recette). */
export function measureBudgetMdEUR(mm: Measure): number {
  return (mm.effets?.budgetMdEUR ?? 0)
    + ((mm.effets?.primaryBalancePct ?? 0) / 100) * 2966;
}

/** Solde net des décisions prises ce trimestre (Md€, + = redressement). */
export function turnBudgetTally(s: GameState): number {
  return ((s.macro.primaryBalancePct - s.scratch.prevPrimary) / 100) * s.macro.pib;
}
