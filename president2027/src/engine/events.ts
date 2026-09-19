import type { GameState, GameEvent } from './types.ts';
import type { Rng } from './rng.ts';
import { weightedIndex } from './rng.ts';
import { applyEffet, evalCondition } from './effects.ts';

/** Index des événements par id (construit une fois côté appelant). */
export function indexEvents(all: GameEvent[]): Map<string, GameEvent> {
  const map = new Map<string, GameEvent>();
  for (const ev of all) map.set(ev.id, ev);
  return map;
}

export function eligibleEvents(state: GameState, all: GameEvent[]): GameEvent[] {
  return all.filter((ev) => {
    if (ev.forced) return false; // déclenchés uniquement par chaîne/moteur
    if (ev.oneShot && state.meta.firedEvents.includes(ev.id)) return false;
    return evalCondition(state, ev.conditions);
  });
}

/**
 * Sélectionne les événements du tour : d'abord les événements enchaînés en
 * file, puis 0-2 événements aléatoires pondérés. Renvoie les ids.
 */
export function selectEvents(
  state: GameState, all: GameEvent[], index: Map<string, GameEvent>, rng: Rng,
  maxRandom = 1,
): string[] {
  const chosen: string[] = [];

  // 1) Événements enchaînés programmés au tour précédent.
  for (const id of state.meta.queuedEvents) {
    if (index.has(id)) chosen.push(id);
  }
  state.meta.queuedEvents = [];

  // 2) Événements aléatoires.
  const pool = eligibleEvents(state, all).filter((ev) => !chosen.includes(ev.id));
  // Probabilité d'un événement aléatoire ce tour (montée si tension/dette).
  const pEvent = 0.55
    + 0.003 * (state.politics.socialTension - 40)
    + 0.002 * Math.max(0, state.macro.debtPct - 118);
  let n = 0;
  while (n < maxRandom && pool.length > 0 && rng.next() < pEvent) {
    const weights = pool.map((ev) => ev.poids);
    const idx = weightedIndex(rng, weights);
    if (idx < 0) break;
    const ev = pool[idx];
    chosen.push(ev.id);
    pool.splice(idx, 1);
    n++;
  }

  for (const id of chosen) {
    const ev = index.get(id);
    if (ev?.oneShot && !state.meta.firedEvents.includes(id)) state.meta.firedEvents.push(id);
  }
  return chosen;
}

/**
 * Résout le choix d'un événement : coût, effets, chaîne éventuelle, journal.
 * Renvoie l'id de l'événement enchaîné (pour l'UI) ou undefined.
 */
export function resolveEventChoice(
  state: GameState, ev: GameEvent, choiceIndex: number,
): string | undefined {
  const choix = ev.choix[choiceIndex];
  if (!choix) return undefined;
  if (choix.cout?.capital) {
    state.politics.capital = Math.max(0, state.politics.capital - choix.cout.capital);
  }
  applyEffet(state, choix.effets);
  state.journal.push({
    turn: state.meta.turn, label: state.meta.dateLabel, type: 'evenement',
    texte: `${ev.titre} → ${choix.label}`,
  });
  if (choix.suite) {
    state.meta.queuedEvents.push(choix.suite);
    return choix.suite;
  }
  return undefined;
}

/** Choix disponibles pour un événement (filtre `requiert`). */
export function availableChoices(state: GameState, ev: GameEvent): number[] {
  const out: number[] = [];
  ev.choix.forEach((c, i) => {
    if (!c.requiert || evalCondition(state, c.requiert)) out.push(i);
  });
  return out;
}
