import type { GameState, ElectionResult, CandidateResult, Famille } from './types.ts';
import { FAMILLES } from './types.ts';
import type { Rng } from './rng.ts';
import { clamp } from './constants.ts';
import { CANDIDATS, PROFILE_POSITION, type Candidat } from '../data/characters.ts';

type Pos = { econ: number; social: number; eu: number };

/** Humeur nationale déduite de l'état du pays (préférence sur les axes). */
function nationalMood(state: GameState): { pref: Pos; antiIncumbent: number } {
  const e = state.economy;
  const soc = state.society;
  // Économie : chômage/inflation élevés => vote plus protecteur/redistributif
  // à gauche ; dette/impôts élevés => attrait de la droite libérale.
  const econPref = clamp(
    0.15 * (state.macro.mandatoryLevies - 43) / 3
    - 0.10 * (e.unemployment - 7) / 2
    - 0.08 * (e.inequality - 50) / 10,
    -1, 1);
  // Social : insécurité + pression migratoire => axe plus autoritaire.
  const socialPref = clamp(
    0.12 * (55 - soc.securite) / 10
    + 0.12 * (soc.immigrationPressure - 55) / 10,
    -1, 1);
  // Europe : réputation/poids faibles => tentation eurosceptique.
  const euPref = clamp(0.2 + 0.1 * (state.intl.europeWeight - 55) / 20, -1, 1);
  const antiIncumbent = clamp((45 - state.politics.popularity) / 30, -1, 1.5);
  return { pref: { econ: econPref, social: socialPref, eu: euPref }, antiIncumbent };
}

function dist(a: Pos, b: Pos): number {
  return Math.sqrt(
    (a.econ - b.econ) ** 2 + (a.social - b.social) ** 2 + 0.5 * (a.eu - b.eu) ** 2);
}

function candPos(c: Candidat): Pos {
  return { econ: c.econLeftRight, social: c.socialLibAuth, eu: c.proEU };
}

/** Attrait d'un candidat (pré-softmax). */
function appeal(c: Candidat, mood: ReturnType<typeof nationalMood>, rng: Rng): number {
  const d = dist(candPos(c), mood.pref);
  const base = c.baseFloor * 100 * c.quality;
  const moodMatch = -18 * d; // proche de l'humeur => bonus
  const noise = (rng.next() - 0.5) * 6;
  return Math.max(1, base + moodMatch + noise);
}

export type PlayerCandidate = {
  id: string; nom: string; famille: Famille; pos: Pos; incumbent: boolean;
};

export function buildPlayerCandidate(state: GameState): PlayerCandidate {
  const pp = PROFILE_POSITION[state.meta.profile];
  return {
    id: 'joueur', nom: 'Le Président sortant', famille: pp.fam,
    pos: { econ: pp.econ, social: pp.social, eu: pp.eu }, incumbent: true,
  };
}

/** Attrait du joueur : socle + bilan + campagne + effet sortant. */
function playerAppeal(state: GameState, pc: PlayerCandidate, mood: ReturnType<typeof nationalMood>, rng: Rng): number {
  const d = dist(pc.pos, mood.pref);
  const bilan =
    0.55 * (state.politics.popularity - 42)
    + 0.5 * (state.economy.purchasingPower - 50)
    - 0.9 * (state.economy.unemployment - 7)
    - 0.5 * Math.max(0, state.macro.deficitPct - 3);
  const usure = -9 - 3 * (state.meta.mandat - 1); // usure du pouvoir
  const campagne = Math.min(5, 1.0 * state.meta.campaignActions);
  const promesses = 2 * state.meta.keptPromises - 3 * state.meta.brokenPromises;
  const moodMatch = -14 * d;
  const noise = (rng.next() - 0.5) * 7;
  return Math.max(1, 15 + bilan + usure + campagne + promesses + moodMatch + noise);
}

/** Premier tour : parts en % des suffrages exprimés + abstention. */
export function firstRound(state: GameState, rng: Rng): ElectionResult {
  const mood = nationalMood(state);
  const pc = buildPlayerCandidate(state);

  const raw: { id: string; nom: string; famille: Famille; a: number; joueur: boolean }[] = [];
  // Un adversaire de la même famille que le joueur est retiré (le joueur l'incarne).
  for (const c of CANDIDATS) {
    if (c.famille === pc.famille) continue;
    raw.push({ id: c.id, nom: c.nom, famille: c.famille, a: appeal(c, mood, rng), joueur: false });
  }
  raw.push({ id: 'joueur', nom: pc.nom, famille: pc.famille, a: playerAppeal(state, pc, mood, rng), joueur: true });

  const total = raw.reduce((s, r) => s + r.a, 0);
  const abstention = clamp(
    26 + 0.3 * (50 - state.politics.institutionalTrust) + 0.2 * (50 - state.society.cohesion),
    15, 55);

  const candidats: CandidateResult[] = raw
    .map((r) => ({ id: r.id, nom: r.nom, famille: r.famille, part: (r.a / total) * 100, joueur: r.joueur }))
    .sort((x, y) => y.part - x.part);

  const joueurQualifie = candidats.slice(0, 2).some((c) => c.joueur);
  return { tour: 1, abstention, candidats, joueurQualifie, joueurGagnant: false };
}

/** Second tour entre les deux premiers, avec reports de voix. */
export function secondRound(state: GameState, first: ElectionResult, rng: Rng): ElectionResult {
  const [a, b] = first.candidats.slice(0, 2);
  const mood = nationalMood(state);
  const posOf = (fam: Famille): Pos => {
    const c = CANDIDATS.find((x) => x.famille === fam);
    if (c) return candPos(c);
    return PROFILE_POSITION[state.meta.profile]
      ? { econ: PROFILE_POSITION[state.meta.profile].econ, social: PROFILE_POSITION[state.meta.profile].social, eu: PROFILE_POSITION[state.meta.profile].eu }
      : { econ: 0, social: 0, eu: 0 };
  };
  const posA = posOf(a.famille);
  const posB = posOf(b.famille);

  let scoreA = a.part;
  let scoreB = b.part;
  // Reports des éliminés selon la proximité (+ front républicain anti-extrême).
  for (const c of first.candidats.slice(2)) {
    const pc = posOf(c.famille);
    const dA = dist(pc, posA);
    const dB = dist(pc, posB);
    // Poids logistique de report vers A.
    let towardA = 1 / (1 + Math.exp((dA - dB) * 1.6));
    // Front républicain : les électeurs modérés se reportent contre la droite
    // nationale si elle est en finale.
    if (a.famille === 'droiteNationale' && c.famille !== 'droiteNationale') towardA -= 0.12;
    if (b.famille === 'droiteNationale' && c.famille !== 'droiteNationale') towardA += 0.12;
    towardA = clamp(towardA, 0.05, 0.95);
    const abstain = 0.12 + 0.08 * Math.min(dA, dB); // certains s'abstiennent
    const reported = c.part * (1 - abstain);
    scoreA += reported * towardA;
    scoreB += reported * (1 - towardA);
  }

  // Effet sortant / humeur anti-système au 2d tour (le sortant paie l'usure).
  const antiInc = mood.antiIncumbent * 6 + 3;
  const swing = (rng.next() - 0.5) * 6 + (a.joueur ? -antiInc : 0) + (b.joueur ? -antiInc : 0);
  scoreA += swing;
  scoreB -= swing;

  const tot = scoreA + scoreB;
  const partA = (scoreA / tot) * 100;
  const partB = 100 - partA;
  const candidats: CandidateResult[] = [
    { id: a.id, nom: a.nom, famille: a.famille, part: partA, joueur: a.joueur },
    { id: b.id, nom: b.nom, famille: b.famille, part: partB, joueur: b.joueur },
  ].sort((x, y) => y.part - x.part);

  const gagnant = candidats[0];
  return {
    tour: 2,
    abstention: clamp(first.abstention - 4 + (rng.next() - 0.5) * 4, 12, 50),
    candidats,
    gagnant: gagnant.id,
    joueurQualifie: true,
    joueurGagnant: gagnant.joueur,
  };
}

/**
 * Législatives : redistribue les sièges (577) selon l'humeur et le résultat
 * présidentiel. Renvoie de nouveaux sièges par famille + cohabitation.
 */
export function legislatives(state: GameState, rng: Rng, presidentFamille: Famille): {
  seats: Record<Famille, number>; cohabitation: boolean; majoriteFamille: Famille | null;
} {
  const mood = nationalMood(state);
  // Score de base par famille : socle + humeur + effet présidentiel (le camp
  // du Président bénéficie d'un élan, sauf usure).
  const scores = {} as Record<Famille, number>;
  const famPos: Record<Famille, Pos> = {
    gaucheRadicale: { econ: -0.9, social: -0.3, eu: -0.2 },
    gaucheSociale: { econ: -0.5, social: -0.2, eu: 0.5 },
    ecologistes: { econ: -0.35, social: -0.4, eu: 0.4 },
    centre: { econ: 0.1, social: 0.1, eu: 0.7 },
    droite: { econ: 0.6, social: 0.4, eu: 0.2 },
    droiteNationale: { econ: 0.3, social: 0.85, eu: -0.8 },
  };
  const floor: Record<Famille, number> = {
    gaucheRadicale: 14, gaucheSociale: 12, ecologistes: 8, centre: 16, droite: 14, droiteNationale: 26,
  };
  for (const f of FAMILLES) {
    const d = dist(famPos[f], mood.pref);
    let s = floor[f] + (-10 * d) + (rng.next() - 0.5) * 6;
    if (f === presidentFamille) s += 6 - 2 * (state.meta.mandat - 1) + 0.2 * (state.politics.popularity - 42);
    scores[f] = Math.max(2, s);
  }
  const totalScore = FAMILLES.reduce((acc, f) => acc + scores[f], 0);
  const seats = {} as Record<Famille, number>;
  let assigned = 0;
  for (const f of FAMILLES) {
    seats[f] = Math.round((scores[f] / totalScore) * 577);
    assigned += seats[f];
  }
  seats.centre += 577 - assigned; // ajustement d'arrondi

  // Majorité absolue ?
  let majoriteFamille: Famille | null = null;
  for (const f of FAMILLES) if (seats[f] >= 289) majoriteFamille = f;
  // Cohabitation si une famille adverse a la majorité (ou un bloc clair adverse).
  const cohabitation = majoriteFamille != null && majoriteFamille !== presidentFamille;

  return { seats, cohabitation, majoriteFamille };
}
