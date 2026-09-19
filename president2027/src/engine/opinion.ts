import type { GameState, Explain, Group, Famille } from './types.ts';
import { GROUPS, FAMILLES } from './types.ts';
import {
  GROUP_WEIGHT, GROUP_SENS, START_SUPPORT, DIFFICULTY, clamp, clamp01x100, round1,
} from './constants.ts';
import { recomputePopularity } from './effects.ts';
import { getProfile } from '../data/profiles.ts';

/**
 * Mise à jour de l'opinion, du capital politique, du soutien parlementaire et
 * de la tension sociale. À appeler après la macro.
 */
export function updateOpinion(state: GameState): Explain[] {
  const p = state.politics;
  const e = state.economy;
  const diff = DIFFICULTY[state.meta.difficulty];
  const profile = getProfile(state.meta.profile);
  const ex: Explain[] = [];
  const popPrev = p.popularity;

  const inertia = diff.opinionInertia;
  const moveFactor = (1 - inertia) * 0.5;

  for (const g of GROUPS) {
    const sens = GROUP_SENS[g];
    const target = clamp01x100(
      50
      + sens.pp * (e.purchasingPower - 50) / 5
      - sens.unemp * (e.unemployment - 7) * 1.6
      - sens.infl * (e.inflation - 2) * 1.8
      - 0.25 * (p.socialTension - 40)
      + profile.charisme
      + groupSpecial(state, g),
    );
    p.groups[g] += (target - p.groups[g]) * moveFactor;
    p.groups[g] = clamp01x100(p.groups[g]);
  }
  recomputePopularity(state, GROUP_WEIGHT);

  // --- Capital politique ---------------------------------------------------
  const regen = diff.capitalRegen + profile.capitalRegenBonus + 0.1 * (p.popularity - 50);
  p.capital = clamp01x100(p.capital + regen * (state.meta.phase === 'CAMPAGNE' ? 0.6 : 1));

  // --- Soutien parlementaire (dérive vers un socle modulé par la popularité)
  for (const f of FAMILLES) {
    const base = START_SUPPORT[f] + (profile.familleAffinite[f] ?? 0);
    const popEffect = 0.25 * (p.popularity - 42);
    const cohabPenalty = p.cohabitation ? -10 : 0;
    const target = clamp01x100(base + popEffect + cohabPenalty);
    p.assembly.support[f] += (target - p.assembly.support[f]) * 0.2;
    p.assembly.support[f] = clamp01x100(p.assembly.support[f]);
  }

  // --- Tension sociale -----------------------------------------------------
  const tensionTarget = clamp01x100(
    28
    + 2.2 * (e.inflation - 2)
    + 1.6 * (e.unemployment - 7)
    + 0.4 * (50 - p.popularity)
    + (state.intl.atWar.length > 0 ? 6 : 0),
  );
  p.socialTension += (tensionTarget - p.socialTension) * 0.3;
  p.socialTension = clamp01x100(p.socialTension);

  // --- Confiance institutionnelle -----------------------------------------
  const trustTarget = clamp01x100(
    40 + 0.3 * (p.popularity - 42)
    - (p.cohabitation ? 6 : 0)
    - (state.meta.flags.includes('art16') ? 20 : 0)
    - p.censureCount * 8,
  );
  p.institutionalTrust += (trustTarget - p.institutionalTrust) * 0.25;
  p.institutionalTrust = clamp01x100(p.institutionalTrust);

  // --- Moral des ministres / relation PM -----------------------------------
  p.ministerMorale += (clamp01x100(45 + 0.4 * (p.popularity - 42)) - p.ministerMorale) * 0.2;
  p.pmRelation = clamp01x100(p.pmRelation - 0.5 + 0.1 * (p.popularity - 42) * 0.1);

  if (p.dissolutionCooldown > 0) p.dissolutionCooldown--;

  ex.push({ label: 'Popularité', delta: round1(p.popularity - popPrev), raison:
    p.popularity > popPrev ? 'Amélioration du pouvoir d\'achat / de la conjoncture.'
    : 'Inflation, chômage ou tension sociale pèsent.' });
  return ex;
}

/** Effets sociologiques spécifiques (ex. état des services publics). */
function groupSpecial(state: GameState, g: Group): number {
  const s = state.society;
  switch (g) {
    case 'retraites': return 0.1 * (s.sante - 46) + 0.1 * (s.securite - 44);
    case 'jeunes': return 0.1 * (s.education - 47) + 0.1 * (s.ecologie - 45);
    case 'fonctionnaires': return 0.15 * (s.education - 47);
    case 'agriculteurs': return -0.1 * (s.ecologie - 45);
    case 'banlieues': return 0.15 * (s.securite - 44) + 0.1 * (s.logement - 40);
    case 'ruralite': return 0.1 * (s.securite - 44) - 0.05 * (s.ecologie - 45);
    case 'patrons': return 0.1 * (state.economy.businessConfidence - 50);
    default: return 0;
  }
}

/** Sièges où le Président a la majorité de soutien (support>50). */
export function majoriteSoutien(state: GameState): number {
  let n = 0;
  for (const f of FAMILLES) {
    if (state.politics.assembly.support[f] > 50) n += state.politics.assembly.seats[f];
  }
  return n;
}

/** Risque de censure 0-100. */
export function risqueCensure(state: GameState): number {
  const p = state.politics;
  const majo = majoriteSoutien(state);
  const deficitSeats = Math.max(0, 289 - majo);
  const risk = clamp(
    deficitSeats / 3
    + (p.socialTension - 40) * 0.5
    + (state.meta.flags.includes('49.3') ? 20 : 0)
    - (p.cohabitation ? 30 : 0),
    0, 100);
  return risk;
}
