import type { GameState, GameEvent, Famille, Phase } from './types.ts';
import { FAMILLES } from './types.ts';
import { rngFromState, type Rng } from './rng.ts';
import { GROUP_WEIGHT } from './constants.ts';
import { recomputePopularity, evalCondition, clampState } from './effects.ts';
import { dateLabel, pushSnapshot } from './state.ts';
import { updateEconomy } from './economy.ts';
import { updateOpinion, risqueCensure } from './opinion.ts';
import { applyPendingEffects } from './measures.ts';
import { selectEvents, indexEvents } from './events.ts';
import { firstRound, secondRound, legislatives, buildPlayerCandidate } from './elections.ts';
import { checkDefeat, computeScore } from './victory.ts';
import { PM_NOMS, PROFILE_POSITION } from '../data/characters.ts';
import { ALL_EVENTS } from '../data/events.ts';
import { checkAchievements } from '../data/achievements.ts';
import { powerById } from '../data/powers.ts';

const EVENT_INDEX = indexEvents(ALL_EVENTS);

/** Recrée le RNG depuis l'état sérialisé, puis resauvegarde son état. */
function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = rngFromState(state.meta.rngState);
  const r = fn(rng);
  state.meta.rngState = rng.state;
  return r;
}

function addMonths(state: GameState, n: number): void {
  let m = state.meta.month + n;
  let y = state.meta.year;
  while (m > 12) { m -= 12; y += 1; }
  state.meta.month = m;
  state.meta.year = y;
}

/**
 * Fait avancer le calendrier et gère les transitions de phase.
 * Renvoie true si le tour qui commence est une élection.
 */
function advanceTimeline(state: GameState): boolean {
  const meta = state.meta;
  if (meta.phase === 'MANDAT') {
    // Fin de partie (bac à sable ou fin du 2d mandat) au-delà de 2031.
    if ((meta.mode === 'bacASable' || meta.mandat >= 2) && meta.year >= 2032) {
      meta.phase = 'FIN';
      return false;
    }
    // Bascule en campagne après décembre 2026 (modes avec élection).
    if (meta.mode !== 'bacASable' && meta.mandat === 1 && meta.year === 2026 && meta.month === 12) {
      meta.phase = 'CAMPAGNE'; meta.month = 1; meta.year = 2027;
      return false;
    }
    addMonths(state, 3);
    return false;
  }
  if (meta.phase === 'CAMPAGNE') {
    if (meta.month >= 3) { meta.month = 4; meta.phase = 'ELECTION'; return true; }
    addMonths(state, 1);
    return false;
  }
  return false;
}

/** Résolution d'une éventuelle motion de censure. */
function resolveCensure(state: GameState, rng: Rng): void {
  if (state.politics.cohabitation) { state.meta.flags = state.meta.flags.filter((f) => f !== '49.3'); return; }
  const risk = risqueCensure(state);
  const p = risk / 100 * 0.5; // au plus ~50 % de chance à risque maximal
  if (rng.next() < p) {
    state.politics.censureCount++;
    state.politics.capital = Math.max(0, state.politics.capital - 25);
    state.politics.socialTension = Math.min(100, state.politics.socialTension + 8);
    state.politics.pmRelation = 40;
    // Nouveau Premier ministre (même famille par défaut).
    const noms = PM_NOMS[state.politics.pmFamily];
    const pm = noms[Math.floor(rng.next() * noms.length)];
    state.depeches.push(`⚠️ Motion de censure ADOPTÉE. Le gouvernement tombe. ${pm} est nommé(e) à Matignon.`);
    state.journal.push({ turn: state.meta.turn, label: state.meta.dateLabel, type: 'systeme',
      texte: `Censure n°${state.politics.censureCount} — nouveau gouvernement (${pm}).` });
  }
  state.meta.flags = state.meta.flags.filter((f) => f !== '49.3');
}

/** Génère les dépêches de briefing du tour. */
function buildBriefing(state: GameState): void {
  const m = state.macro; const e = state.economy; const p = state.politics;
  const front: string[] = [];
  front.push(`Déficit ${m.deficitPct.toFixed(1)} % du PIB · Dette ${m.debtPct.toFixed(0)} % · Croissance ${e.growth.toFixed(1)} % · Chômage ${e.unemployment.toFixed(1)} %`);
  if (m.spread > 200) front.push('🟥 Les marchés s\'inquiètent : le spread se tend fortement.');
  if (e.inflation > 4) front.push('🟧 L\'inflation ronge le pouvoir d\'achat.');
  if (p.socialTension > 70) front.push('🟥 Le climat social est explosif.');
  if (risqueCensure(state) > 60 && !p.cohabitation) front.push('🟧 Une motion de censure plane sur le gouvernement.');
  if (p.cohabitation) front.push('🏛️ Cohabitation : la politique intérieure échappe largement au Président.');
  if (state.intl.atWar.length > 0) front.push(`🎖️ Engagement militaire en cours : ${state.intl.atWar.join(', ')}.`);
  for (const f of front) state.depeches.push(f);
}

/** Résout l'élection présidentielle 2027 (1er + 2d tour). */
function runPresidential(state: GameState): void {
  withRng(state, (rng) => {
    const first = firstRound(state, rng);
    let result = first;
    state.journal.push({ turn: state.meta.turn, label: state.meta.dateLabel, type: 'election',
      texte: `1er tour : ${first.candidats.map((c) => `${c.nom} ${c.part.toFixed(1)}%`).join(', ')} (abst. ${first.abstention.toFixed(0)}%).` });
    if (first.joueurQualifie || true) {
      const second = secondRound(state, first, rng);
      result = second;
      state.journal.push({ turn: state.meta.turn, label: state.meta.dateLabel, type: 'election',
        texte: `2d tour : ${second.candidats.map((c) => `${c.nom} ${c.part.toFixed(1)}%`).join(' / ')}.` });
    }
    state.lastElection = result;

    if (result.joueurGagnant) {
      state.depeches.push('🎉 Réélu(e) ! Le second mandat commence, plus difficile que le premier.');
      state.meta.mandat = 2;
      state.meta.phase = 'MANDAT';
      state.meta.month = 7; state.meta.year = 2027;
      // Usure du pouvoir : légère érosion de départ.
      state.politics.capital = Math.max(20, state.politics.capital - 8);
      state.politics.popularity = Math.max(20, state.politics.popularity - 4);
      // Législatives dans la foulée.
      const presFam = PROFILE_POSITION[state.meta.profile].fam;
      applyLegislatives(state, rng, presFam);
      if (state.meta.mode === 'campagne') finishGame(state, 'Campagne remportée', true);
    } else {
      const gagnant = result.candidats[0];
      state.depeches.push(`🗳️ Défaite. ${gagnant.nom} est élu(e) Président(e) de la République.`);
      finishGame(state, 'Défaite à la présidentielle', false);
    }
  });
}

function applyLegislatives(state: GameState, rng: Rng, presFam: Famille): void {
  const res = legislatives(state, rng, presFam);
  state.politics.assembly.seats = res.seats;
  state.politics.cohabitation = res.cohabitation;
  if (res.cohabitation && res.majoriteFamille) {
    state.politics.pmFamily = res.majoriteFamille;
    const noms = PM_NOMS[res.majoriteFamille];
    const pm = noms[Math.floor(rng.next() * noms.length)];
    state.depeches.push(`🏛️ Législatives : majorité ${res.majoriteFamille}. Cohabitation. ${pm} devient Premier ministre.`);
  } else {
    state.depeches.push('🏛️ Législatives : le camp présidentiel évite la cohabitation.');
  }
  state.journal.push({ turn: state.meta.turn, label: state.meta.dateLabel, type: 'election',
    texte: `Législatives : ${FAMILLES.map((f) => `${f} ${res.seats[f]}`).join(', ')}.` });
}

/** Termine la partie avec un bilan. */
export function finishGame(state: GameState, raison: string, victoireForcee?: boolean): void {
  const sc = computeScore(state);
  if (victoireForcee !== undefined) sc.victoire = victoireForcee;
  sc.raison = raison;
  sc.titre = victoireForcee === false ? raison : sc.titre;
  state.end = sc;
  state.meta.phase = 'FIN';
  checkAchievements(state);
}

// ---------------------------------------------------------------------------
// API principale du tour.
// ---------------------------------------------------------------------------

/**
 * Termine le trimestre/mois courant : résolutions macro/opinion, censure,
 * transition de phase, sélection des événements du tour suivant, fin éventuelle.
 * Les actions du joueur (mesures, choix d'événements) ont déjà été appliquées.
 */
export function endTurn(state: GameState): void {
  if (state.meta.phase === 'FIN') return;

  // Nettoyage de l'affichage.
  state.depeches = [];
  state.explain = [];

  // 1) Avance calendrier + phase.
  const isElection = advanceTimeline(state);
  state.meta.turn++;
  state.meta.dateLabel = dateLabel(state.meta.year, state.meta.month, state.meta.phase);

  // (le cast contourne l'analyse de flux : advanceTimeline mute la phase)
  if ((state.meta.phase as Phase) === 'FIN') { finishGame(state, 'Mandat achevé'); return; }

  if (isElection) {
    runPresidential(state);
    if ((state.meta.phase as Phase) === 'FIN') return;
    // après réélection, on enchaîne sur un tour de mandat normal.
  }

  // 2) Effets différés arrivés à échéance.
  applyPendingEffects(state);

  // 3) Macro puis opinion.
  const exEco = updateEconomy(state, require_nervous(state));
  const exOp = updateOpinion(state);
  state.explain = [...exEco, ...exOp];

  // 4) Censure (uniquement en période de gouvernement).
  if (state.meta.phase === 'MANDAT') withRng(state, (rng) => resolveCensure(state, rng));

  // 5) Reset des points d'action.
  state.politics.actionPoints = state.politics.maxActionPoints;

  // 6) Événements du tour.
  state.currentEvents = withRng(state, (rng) => selectEvents(state, ALL_EVENTS, EVENT_INDEX, rng, state.meta.phase === 'CAMPAGNE' ? 1 : 1));

  // 7) Briefing.
  buildBriefing(state);
  recomputePopularity(state, GROUP_WEIGHT);

  // 8) Snapshot + fin éventuelle.
  pushSnapshot(state);
  const defeat = checkDefeat(state);
  if (defeat) { state.end = defeat; state.meta.phase = 'FIN'; checkAchievements(state); return; }

  checkAchievements(state);
}

function require_nervous(state: GameState): number {
  // évite un import circulaire de DIFFICULTY dans plusieurs modules
  const map: Record<string, number> = { facile: 0.7, normal: 1.0, realiste: 1.12, impitoyable: 1.35 };
  return map[state.meta.difficulty] ?? 1.0;
}

/** Récupère un événement par id. */
export function getEvent(id: string): GameEvent | undefined {
  return EVENT_INDEX.get(id);
}

// ---------------------------------------------------------------------------
// Pouvoirs présidentiels (logique dédiée).
// ---------------------------------------------------------------------------
export type PowerResult = { ok: boolean; message: string };

export function usePower(state: GameState, id: string): PowerResult {
  const p = state.politics;
  const power = powerById(id);
  if (!power) return { ok: false, message: 'Pouvoir inconnu.' };
  if (p.actionPoints < power.coutActionPoints) return { ok: false, message: 'Pas assez de points d\'action.' };
  if (p.capital < power.coutCapital) return { ok: false, message: 'Capital politique insuffisant.' };
  if (power.conditions && !evalCondition(state, power.conditions)) return { ok: false, message: 'Conditions non réunies.' };

  p.actionPoints -= power.coutActionPoints;
  p.capital = Math.max(0, p.capital - power.coutCapital);
  let message = '';

  switch (id) {
    case 'pouv_remaniement': {
      p.ministerMorale = Math.min(100, p.ministerMorale + 18);
      p.pmRelation = Math.min(100, p.pmRelation + 10);
      p.socialTension = Math.max(0, p.socialTension - 4);
      message = 'Remaniement : nouvelle équipe, élan retrouvé.';
      break;
    }
    case 'pouv_pm_ouverture': {
      withRng(state, (rng) => {
        // Élargit vers la famille voisine la plus forte à l'Assemblée.
        const cands: Famille[] = ['gaucheSociale', 'droite', 'ecologistes'];
        const target = cands.reduce((a, b) => p.assembly.seats[a] >= p.assembly.seats[b] ? a : b);
        p.pmFamily = target;
        p.assembly.support[target] = Math.min(100, p.assembly.support[target] + 20);
        p.assembly.support.centre = Math.max(0, p.assembly.support.centre - 6);
        const noms = PM_NOMS[target];
        message = `${noms[Math.floor(rng.next() * noms.length)]} nommé(e) Premier ministre d'ouverture (${target}).`;
      });
      break;
    }
    case 'pouv_49_3': {
      if (!p.cohabitation) {
        p.socialTension = Math.min(100, p.socialTension + 8);
        state.macro.primaryBalancePct += 0.3; // fait passer un budget de rigueur
        if (!state.meta.flags.includes('49.3')) state.meta.flags.push('49.3');
        message = 'Texte adopté au 49.3. La censure guette.';
      } else return { ok: false, message: 'Impossible en cohabitation.' };
      break;
    }
    case 'pouv_dissolution': {
      withRng(state, (rng) => {
        const presFam = PROFILE_POSITION[state.meta.profile].fam;
        applyLegislatives(state, rng, presFam);
        p.dissolutionCooldown = 4;
        message = p.cohabitation ? 'Dissolution : le pari est perdu, cohabitation.' : 'Dissolution : une majorité se dégage.';
      });
      break;
    }
    case 'pouv_referendum': {
      withRng(state, (rng) => {
        p.lastReferendumTurn = state.meta.turn;
        const chance = 0.35 + (p.popularity - 40) / 120;
        if (rng.next() < chance) {
          p.institutionalTrust = Math.min(100, p.institutionalTrust + 10);
          p.capital = Math.min(100, p.capital + 12);
          state.society.cohesion = Math.min(100, state.society.cohesion + 4);
          message = 'Référendum GAGNÉ : légitimité renforcée.';
        } else {
          p.institutionalTrust = Math.max(0, p.institutionalTrust - 12);
          p.popularity = Math.max(0, p.popularity - 6);
          p.socialTension = Math.min(100, p.socialTension + 6);
          message = 'Référendum PERDU : cinglant désaveu.';
        }
      });
      break;
    }
    case 'pouv_art16': {
      if (!state.meta.flags.includes('art16')) state.meta.flags.push('art16');
      p.institutionalTrust = Math.max(0, p.institutionalTrust - 20);
      p.socialTension = Math.max(0, p.socialTension - 10);
      state.society.securite = Math.min(100, state.society.securite + 6);
      message = 'Pouvoirs exceptionnels activés. Le régime vacille sur ses principes.';
      break;
    }
    case 'pouv_grace': {
      state.society.justice = Math.min(100, state.society.justice + 1);
      message = 'Grâce accordée.';
      break;
    }
    case 'pouv_message': {
      p.capital = Math.min(100, p.capital + 3);
      p.institutionalTrust = Math.min(100, p.institutionalTrust + 2);
      message = 'Message au Congrès : le cap est réaffirmé.';
      break;
    }
    default:
      message = power.titre;
  }

  state.journal.push({ turn: state.meta.turn, label: state.meta.dateLabel, type: 'systeme', texte: `Pouvoir : ${power.titre}. ${message}` });
  clampState(state);
  return { ok: true, message };
}

export { ALL_EVENTS, buildPlayerCandidate };
