import type {
  GameState, Effet, Condition, Group, Famille,
} from './types.ts';
import { clamp, clamp01x100, BOUNDS } from './constants.ts';

// ---------------------------------------------------------------------------
// Lecture d'une valeur par chemin (pour les conditions et les stratégies IA).
// Ex : "macro.debtPct", "economy.growth", "politics.groups.retraites",
// "intl.relations.russie", "meta.turn".
// ---------------------------------------------------------------------------
export function getPath(state: GameState, path: string): number {
  const parts = path.split('.');
  let cur: any = state;
  for (const p of parts) {
    if (cur == null) return 0;
    cur = cur[p];
  }
  return typeof cur === 'number' ? cur : 0;
}

// ---------------------------------------------------------------------------
// Évaluation d'une condition déclarative.
// ---------------------------------------------------------------------------
export function evalCondition(state: GameState, cond: Condition | undefined): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evalCondition(state, c));
  if ('any' in cond) return cond.any.some((c) => evalCondition(state, c));
  if ('not' in cond) return !evalCondition(state, cond.not);
  if ('flag' in cond) {
    const has = state.meta.flags.includes(cond.flag);
    return cond.present === false ? !has : has;
  }
  if ('phase' in cond) return state.meta.phase === cond.phase;
  if ('minTurn' in cond || 'maxTurn' in cond) {
    const t = state.meta.turn;
    if (cond.minTurn !== undefined && t < cond.minTurn) return false;
    if (cond.maxTurn !== undefined && t > cond.maxTurn) return false;
    return true;
  }
  if ('path' in cond) {
    const v = getPath(state, cond.path);
    switch (cond.op) {
      case '<': return v < cond.value;
      case '<=': return v <= cond.value;
      case '>': return v > cond.value;
      case '>=': return v >= cond.value;
      case '==': return v === cond.value;
      case '!=': return v !== cond.value;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Application d'un effet (patch additif) puis clamp de l'état.
// ---------------------------------------------------------------------------
function addGauge(obj: any, key: string, delta: number) {
  obj[key] = (obj[key] ?? 0) + delta;
}

export function applyEffet(state: GameState, effet: Effet | undefined): void {
  if (!effet) return;

  if (effet.macro) {
    for (const k in effet.macro) addGauge(state.macro, k, (effet.macro as any)[k]);
  }
  if (effet.economy) {
    for (const k in effet.economy) addGauge(state.economy, k, (effet.economy as any)[k]);
  }
  if (effet.society) {
    for (const k in effet.society) addGauge(state.society, k, (effet.society as any)[k]);
  }
  if (effet.politics) {
    for (const k in effet.politics) addGauge(state.politics, k, (effet.politics as any)[k]);
  }
  if (effet.groups) {
    for (const g in effet.groups) addGauge(state.politics.groups, g, (effet.groups as any)[g]);
  }
  if (effet.assembly) {
    for (const f in effet.assembly) addGauge(state.politics.assembly.support, f, (effet.assembly as any)[f]);
  }
  if (effet.intl) {
    for (const k in effet.intl) addGauge(state.intl, k, (effet.intl as any)[k]);
  }
  if (effet.relations) {
    for (const p in effet.relations) addGauge(state.intl.relations, p, (effet.relations as any)[p]);
  }

  // Canaux budgétaires -> solde primaire (% PIB).
  if (effet.budgetMdEUR) {
    state.macro.primaryBalancePct += (effet.budgetMdEUR / state.macro.pib) * 100;
  }
  if (effet.primaryBalancePct) {
    state.macro.primaryBalancePct += effet.primaryBalancePct;
  }
  if (effet.debtOneOff) {
    state.macro.debt += effet.debtOneOff;
  }
  if (effet.growthShock) state.scratch.growthShock += effet.growthShock;
  if (effet.energyShock) state.scratch.energyShock += effet.energyShock;

  // Drapeaux.
  if (effet.flags) {
    for (const f of effet.flags) if (!state.meta.flags.includes(f)) state.meta.flags.push(f);
  }
  if (effet.clearFlags) {
    state.meta.flags = state.meta.flags.filter((f) => !effet.clearFlags!.includes(f));
  }

  clampState(state);
}

// ---------------------------------------------------------------------------
// Clamp de toutes les jauges bornées.
// ---------------------------------------------------------------------------
const GROUP_KEYS: Group[] = [
  'jeunes', 'retraites', 'classesMoyennes', 'classesPopulaires', 'cadres',
  'agriculteurs', 'fonctionnaires', 'patrons', 'banlieues', 'ruralite',
];
const FAM_KEYS: Famille[] = [
  'gaucheRadicale', 'gaucheSociale', 'ecologistes', 'centre', 'droite', 'droiteNationale',
];

export function clampState(s: GameState): void {
  const m = s.macro;
  m.spread = clamp(m.spread, BOUNDS.spread[0], BOUNDS.spread[1]);
  m.marketRate = clamp(m.marketRate, BOUNDS.marketRate[0], BOUNDS.marketRate[1]);
  m.apparentRate = clamp(m.apparentRate, BOUNDS.apparentRate[0], BOUNDS.apparentRate[1]);
  m.mandatoryLevies = clamp(m.mandatoryLevies, BOUNDS.mandatoryLevies[0], BOUNDS.mandatoryLevies[1]);
  m.deficitPct = clamp(m.deficitPct, BOUNDS.deficitPct[0], BOUNDS.deficitPct[1]);
  m.debt = Math.max(0, m.debt);
  if (m.pib > 0) m.debtPct = (m.debt / m.pib) * 100;
  m.primaryBalancePct = clamp(m.primaryBalancePct, -12, 8);

  const e = s.economy;
  e.growth = clamp(e.growth, BOUNDS.growth[0], BOUNDS.growth[1]);
  e.unemployment = clamp(e.unemployment, BOUNDS.unemployment[0], BOUNDS.unemployment[1]);
  e.inflation = clamp(e.inflation, BOUNDS.inflation[0], BOUNDS.inflation[1]);
  e.tradeBalance = clamp(e.tradeBalance, BOUNDS.tradeBalance[0], BOUNDS.tradeBalance[1]);
  e.purchasingPower = clamp01x100(e.purchasingPower);
  e.competitiveness = clamp01x100(e.competitiveness);
  e.investment = clamp01x100(e.investment);
  e.inequality = clamp01x100(e.inequality);
  e.businessConfidence = clamp01x100(e.businessConfidence);

  const p = s.politics;
  p.popularity = clamp01x100(p.popularity);
  p.capital = clamp01x100(p.capital);
  p.pmRelation = clamp01x100(p.pmRelation);
  p.ministerMorale = clamp01x100(p.ministerMorale);
  p.socialTension = clamp01x100(p.socialTension);
  p.institutionalTrust = clamp01x100(p.institutionalTrust);
  for (const g of GROUP_KEYS) p.groups[g] = clamp01x100(p.groups[g]);
  for (const f of FAM_KEYS) p.assembly.support[f] = clamp01x100(p.assembly.support[f]);

  const soc = s.society as any;
  for (const k in soc) if (typeof soc[k] === 'number') soc[k] = clamp01x100(soc[k]);

  const it = s.intl;
  it.reputation = clamp01x100(it.reputation);
  it.europeWeight = clamp01x100(it.europeWeight);
  it.armyStrength = clamp01x100(it.armyStrength);
  it.armyMorale = clamp01x100(it.armyMorale);
  it.ammoStock = clamp01x100(it.ammoStock);
  it.deterrence = clamp01x100(it.deterrence);
  for (const p2 in it.relations) {
    (it.relations as any)[p2] = clamp((it.relations as any)[p2], -100, 100);
  }
}

/** Popularité globale = moyenne pondérée des groupes. */
export function recomputePopularity(s: GameState, weights: Record<Group, number>): void {
  let total = 0;
  let sum = 0;
  for (const g of GROUP_KEYS) {
    total += weights[g];
    sum += weights[g] * s.politics.groups[g];
  }
  s.politics.popularity = clamp01x100(total > 0 ? sum / total : 50);
}
