import type {
  GameState, ProfileId, Difficulty, Mode, Group, Famille, Snapshot,
} from './types.ts';
import { GROUPS, FAMILLES } from './types.ts';
import {
  START, START_RATING, START_SEATS, START_SUPPORT, DIFFICULTY, GROUP_WEIGHT,
} from './constants.ts';
import { getProfile } from '../data/profiles.ts';
import { initialRelations } from '../data/countries.ts';
import { applyEffet, clampState, recomputePopularity } from './effects.ts';
import { hashSeed } from './rng.ts';

/** Libellé de date à partir de l'année et du mois. */
export function dateLabel(year: number, month: number, phase: string): string {
  const mois = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
    'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  if (phase === 'CAMPAGNE' || phase === 'ELECTION') return `${mois[month - 1]} ${year}`;
  const q = Math.ceil(month / 3);
  return `T${q} ${year}`;
}

export type NewGameOptions = {
  seed: string;
  profile: ProfileId;
  difficulty: Difficulty;
  mode: Mode;
};

export function createInitialState(opts: NewGameOptions): GameState {
  const diff = DIFFICULTY[opts.difficulty];
  const profile = getProfile(opts.profile);

  const groups = {} as Record<Group, number>;
  for (const g of GROUPS) groups[g] = 45 + (profile.groupBonus[g] ?? 0);

  const support = {} as Record<Famille, number>;
  const seats = {} as Record<Famille, number>;
  for (const f of FAMILLES) {
    support[f] = START_SUPPORT[f] + (profile.familleAffinite[f] ?? 0);
    seats[f] = START_SEATS[f];
  }

  const state: GameState = {
    meta: {
      turn: 0,
      year: 2026,
      month: 9,
      dateLabel: 'T3 2026',
      phase: 'MANDAT',
      seed: opts.seed,
      rngState: hashSeed(opts.seed),
      profile: opts.profile,
      difficulty: opts.difficulty,
      mode: opts.mode,
      mandat: 1,
      seRepresente: true,
      promises: [],
      keptPromises: 0,
      brokenPromises: 0,
      flags: [],
      achievements: [],
      pendingEffects: [],
      usedMeasures: [],
      firedEvents: [],
      advisorBiasSeed: hashSeed(opts.seed + ':advisors'),
      campaignActions: 0,
      queuedEvents: [],
      dangerCounters: {},
    },
    scratch: { growthShock: 0, energyShock: 0, prevPrimary: START.primaryBalancePct },
    macro: {
      pib: START.pib,
      deficitPct: START.deficitPct,
      debt: START.debt,
      debtPct: (START.debt / START.pib) * 100,
      primaryBalancePct: START.primaryBalancePct,
      marketRate: START.marketRate,
      apparentRate: START.apparentRate,
      interestCharge: (START.apparentRate / 100) * START.debt,
      spread: START.spread,
      mandatoryLevies: START.mandatoryLevies,
      ratings: { sp: START_RATING, moody: START_RATING, fitch: START_RATING },
      ratingTrend: { sp: 0, moody: 0, fitch: 0 },
    },
    economy: {
      growth: 0.8, unemployment: 7.5, inflation: 2.4, purchasingPower: 48,
      competitiveness: 48, investment: 50, tradeBalance: -1.8, inequality: 55,
      businessConfidence: 52,
    },
    politics: {
      popularity: 42,
      groups,
      capital: diff.startCapital,
      actionPoints: diff.actionPoints,
      maxActionPoints: diff.actionPoints,
      assembly: { seats, support },
      pmRelation: 62,
      pmFamily: 'centre',
      ministerMorale: 60,
      socialTension: 40,
      institutionalTrust: 48,
      cohabitation: false,
      censureCount: 0,
      dissolutionCooldown: 0,
      lastReferendumTurn: -99,
    },
    society: {
      sante: 46, education: 47, securite: 44, justice: 42, ecologie: 45,
      energie: 55, demographie: 48, immigrationPressure: 55, logement: 40,
      cohesion: 44,
    },
    intl: {
      reputation: 58, europeWeight: 60, armyStrength: 58, armyMorale: 60,
      ammoStock: 45, deterrence: 75, atWar: [], relations: initialRelations(),
    },
    history: [],
    journal: [],
    depeches: [],
    explain: [],
    currentEvents: [],
  };

  // Applique le patch de départ du profil (peut viser toutes les sphères).
  applyEffet(state, profile.startPatch);
  // Capital regen bonus du profil : stocké via flag lisible par l'opinion/engine.
  state.meta.flags.push(`profil:${profile.id}`);

  clampState(state);
  recomputePopularity(state, GROUP_WEIGHT);
  state.scratch.prevPrimary = state.macro.primaryBalancePct;

  state.journal.push({
    turn: 0, label: state.meta.dateLabel, type: 'systeme',
    texte: `Prise de fonction — profil « ${profile.nom} », difficulté ${opts.difficulty}. Graine : ${opts.seed}.`,
  });
  pushSnapshot(state);
  return state;
}

export function pushSnapshot(state: GameState): void {
  const s: Snapshot = {
    turn: state.meta.turn,
    label: state.meta.dateLabel,
    deficitPct: state.macro.deficitPct,
    debtPct: state.macro.debtPct,
    popularity: state.politics.popularity,
    growth: state.economy.growth,
    unemployment: state.economy.unemployment,
    capital: state.politics.capital,
    socialTension: state.politics.socialTension,
  };
  state.history.push(s);
}

/** Clone profond par sérialisation (état 100 % JSON). */
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}
