import type { GameState, Measure, Effet, Domaine } from './types.ts';
import { applyEffet, evalCondition } from './effects.ts';

// Domaines bridés en cohabitation (politique intérieure au PM). Le domaine
// réservé (diplomatie, défense, Europe, institutions) reste au Président.
const COHAB_RESTRICTED: Domaine[] = [
  'budget', 'fiscalite', 'social', 'dette', 'interieur', 'energie', 'ecologie',
  'education', 'sante', 'securite', 'immigration', 'economie',
];

export type Availability = { ok: boolean; raison?: string };

export function measureAvailability(state: GameState, m: Measure): Availability {
  const p = state.politics;
  if (m.oneShot && state.meta.usedMeasures.includes(m.id)) {
    return { ok: false, raison: 'Déjà utilisée (mesure unique).' };
  }
  if (!evalCondition(state, m.conditions)) {
    return { ok: false, raison: 'Conditions non réunies.' };
  }
  if (p.actionPoints < m.cout.actionPoints) {
    return { ok: false, raison: 'Pas assez de points d\'action ce trimestre.' };
  }
  const capitalCost = cohabExtraCost(state, m) ? m.cout.capital * 2 : m.cout.capital;
  if (p.capital < capitalCost) {
    return { ok: false, raison: 'Capital politique insuffisant.' };
  }
  return { ok: true };
}

function cohabExtraCost(state: GameState, m: Measure): boolean {
  return state.politics.cohabitation && COHAB_RESTRICTED.includes(m.domaine);
}

/** Multiplie tous les champs numériques d'un effet (copie). */
export function scaleEffet(effet: Effet, k: number): Effet {
  const out: Effet = JSON.parse(JSON.stringify(effet));
  const scaleRec = (o: any) => {
    for (const key in o) {
      if (typeof o[key] === 'number') o[key] *= k;
      else if (o[key] && typeof o[key] === 'object') scaleRec(o[key]);
    }
  };
  // Ne pas toucher aux tableaux de drapeaux.
  const flags = out.flags; const clearFlags = out.clearFlags;
  delete (out as any).flags; delete (out as any).clearFlags;
  scaleRec(out);
  if (flags) out.flags = flags;
  if (clearFlags) out.clearFlags = clearFlags;
  return out;
}

/**
 * Applique une mesure : coûts, effet immédiat, effet différé programmé.
 * Suppose que `measureAvailability` a déjà été validée.
 */
export function applyMeasure(state: GameState, m: Measure): void {
  const p = state.politics;
  const cohabReduce = cohabExtraCost(state, m);
  const capitalCost = cohabReduce ? m.cout.capital * 2 : m.cout.capital;
  p.actionPoints -= m.cout.actionPoints;
  p.capital = Math.max(0, p.capital - capitalCost);

  // Facteur d'efficacité : cohabitation réduit l'effet intérieur ; le profil
  // Réformateur amplifie les réformes structurelles (effets différés).
  const effFactor = cohabReduce ? 0.3 : 1;
  const reformateur = state.meta.profile === 'reformateur';

  if (m.effets) applyEffet(state, effFactor === 1 ? m.effets : scaleEffet(m.effets, effFactor));

  if (m.effetsDiffered && m.delaiTours && m.delaiTours > 0) {
    let eff = m.effetsDiffered;
    if (reformateur) eff = scaleEffet(eff, 1.3);
    if (effFactor !== 1) eff = scaleEffet(eff, effFactor);
    state.meta.pendingEffects.push({
      dueTurn: state.meta.turn + m.delaiTours,
      effet: eff,
      label: `Effet différé : ${m.titre}`,
    });
  } else if (m.effetsDiffered) {
    // delaiTours absent : traité comme immédiat.
    applyEffet(state, reformateur ? scaleEffet(m.effetsDiffered, 1.3) : m.effetsDiffered);
  }

  if (m.oneShot) state.meta.usedMeasures.push(m.id);

  // Suivi des promesses de campagne.
  if (state.meta.promises.includes(m.id)) {
    state.meta.keptPromises++;
    state.meta.promises = state.meta.promises.filter((x) => x !== m.id);
  }

  state.journal.push({
    turn: state.meta.turn, label: state.meta.dateLabel, type: 'mesure',
    texte: cohabReduce ? `${m.titre} (effet réduit — cohabitation)` : m.titre,
  });
}

/** Applique les effets différés arrivés à échéance ce tour. */
export function applyPendingEffects(state: GameState): void {
  const due = state.meta.pendingEffects.filter((pe) => pe.dueTurn <= state.meta.turn);
  state.meta.pendingEffects = state.meta.pendingEffects.filter((pe) => pe.dueTurn > state.meta.turn);
  for (const pe of due) {
    applyEffet(state, pe.effet);
    state.depeches.push(`⏳ ${pe.label} se fait sentir.`);
  }
}
