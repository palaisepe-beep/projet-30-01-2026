// Point d'entrée public du moteur (utilisé par l'UI et la simulation).
export * from './types.ts';
export { createInitialState, cloneState, dateLabel, type NewGameOptions } from './state.ts';
export { endTurn, usePower, getEvent, finishGame, ALL_EVENTS, buildPlayerCandidate, type PowerResult } from './engine.ts';
export { measureAvailability, applyMeasure, type Availability } from './measures.ts';
export { resolveEventChoice, availableChoices } from './events.ts';
export { getPath, evalCondition } from './effects.ts';
export { risqueCensure, majoriteSoutien } from './opinion.ts';
export { objectifs, computeScore } from './victory.ts';
export { projectedDeficit, measureDeficitDelta, measureBudgetMdEUR, turnBudgetTally } from './preview.ts';
export { firstRound, secondRound } from './elections.ts';
export { createRng, hashSeed, rngFromState, type Rng } from './rng.ts';
export { ratingLabel, RATING_LABELS, GROUP_WEIGHT, MAJORITE_ABSOLUE } from './constants.ts';

// Données ré-exportées pour l'UI.
export { MEASURES } from '../data/measures.ts';
export { POWERS, powerById, type Power } from '../data/powers.ts';
export { PROFILES, getProfile, type Profile } from '../data/profiles.ts';
export { PARTIS, partiOf, CONSEILLERS, CANDIDATS, type Conseiller } from '../data/characters.ts';
export { PAYS, paysById, type Pays } from '../data/countries.ts';
export { ACHIEVEMENTS, achievementById, type Achievement } from '../data/achievements.ts';
