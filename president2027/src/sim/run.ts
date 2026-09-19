import {
  createInitialState, endTurn, getEvent, availableChoices, resolveEventChoice,
  computeScore, type GameState, type ProfileId, type Difficulty, type Mode,
} from '../engine/index.ts';
import { createRng } from '../engine/rng.ts';
import { STRATEGIES, type Strategy } from './strategies.ts';

type GameResult = {
  victoire: boolean; score: number; note: string; raison: string;
  mandat: number; reelu: boolean; turns: number;
  deficit: number; debtPct: number; popularity: number;
};

const PROFILES: ProfileId[] = ['technocrate', 'tribun', 'reformateur', 'souverainiste', 'ecologiste'];

function playGame(seed: string, profile: ProfileId, difficulty: Difficulty, mode: Mode, strat: Strategy): GameResult {
  const s: GameState = createInitialState({ seed, profile, difficulty, mode });
  const rng = createRng(seed + ':' + strat.nom);
  let guard = 0;
  while (s.meta.phase !== 'FIN' && guard++ < 80) {
    for (const id of [...s.currentEvents]) {
      const ev = getEvent(id);
      if (!ev) continue;
      const choices = availableChoices(s, ev);
      if (choices.length === 0) continue;
      let idx = strat.chooseEvent(s, choices, rng);
      if (!choices.includes(idx)) idx = choices[0];
      resolveEventChoice(s, ev, idx);
    }
    s.currentEvents = [];
    strat.act(s, rng);
    endTurn(s);
  }
  const end = s.end ?? computeScore(s);
  return {
    victoire: end.victoire, score: end.score, note: end.note, raison: end.raison,
    mandat: s.meta.mandat, reelu: s.meta.mandat >= 2, turns: s.meta.turn,
    deficit: s.macro.deficitPct, debtPct: s.macro.debtPct, popularity: s.politics.popularity,
  };
}

type Agg = {
  n: number; victoires: number; reelus: number; scoreSum: number;
  raisons: Record<string, number>; deficitSum: number; debtSum: number;
};

function newAgg(): Agg { return { n: 0, victoires: 0, reelus: 0, scoreSum: 0, raisons: {}, deficitSum: 0, debtSum: 0 }; }

function runStrategy(key: string, strat: Strategy, gamesPerStrat: number, difficulty: Difficulty, mode: Mode): Agg {
  const agg = newAgg();
  for (let i = 0; i < gamesPerStrat; i++) {
    const profile = PROFILES[i % PROFILES.length];
    const r = playGame(`SIM-${key}-${i}`, profile, difficulty, mode, strat);
    agg.n++;
    if (r.victoire) agg.victoires++;
    if (r.reelu) agg.reelus++;
    agg.scoreSum += r.score;
    agg.deficitSum += r.deficit;
    agg.debtSum += r.debtPct;
    agg.raisons[r.raison] = (agg.raisons[r.raison] ?? 0) + 1;
  }
  return agg;
}

function fmtPct(x: number, n: number): string { return `${((x / n) * 100).toFixed(1)}%`; }

function main() {
  const gamesPerStrat = parseInt(process.argv[2] ?? '200', 10);
  const difficulty: Difficulty = (process.argv[3] as Difficulty) ?? 'normal';
  const mode: Mode = (process.argv[4] as Mode) ?? 'complet';
  const keys = Object.keys(STRATEGIES);
  const total = gamesPerStrat * keys.length;

  console.log(`# Simulation d'équilibrage — Président 2027`);
  console.log(`Parties : ${total} (${gamesPerStrat}/stratégie) · difficulté ${difficulty} · mode ${mode}\n`);
  const header = 'Stratégie'.padEnd(20) + 'Victoires'.padEnd(11) + 'Réélus'.padEnd(9) + 'Score moy.'.padEnd(11) + 'Déf. moy.'.padEnd(10) + 'Dette moy.';
  console.log(header);
  console.log('-'.repeat(header.length));

  const allAgg: Record<string, Agg> = {};
  for (const key of keys) {
    const agg = runStrategy(key, STRATEGIES[key], gamesPerStrat, difficulty, mode);
    allAgg[key] = agg;
    console.log(
      STRATEGIES[key].nom.padEnd(20) +
      fmtPct(agg.victoires, agg.n).padEnd(11) +
      fmtPct(agg.reelus, agg.n).padEnd(9) +
      (agg.scoreSum / agg.n).toFixed(1).padEnd(11) +
      (agg.deficitSum / agg.n).toFixed(1).padEnd(10) +
      (agg.debtSum / agg.n).toFixed(0),
    );
  }

  console.log('\n## Répartition des fins de partie');
  for (const key of keys) {
    const agg = allAgg[key];
    const parts = Object.entries(agg.raisons).sort((a, b) => b[1] - a[1])
      .map(([r, c]) => `${r}: ${fmtPct(c, agg.n)}`).join(' · ');
    console.log(`- ${STRATEGIES[key].nom} → ${parts}`);
  }

  // Verdict équilibrage.
  const wr = (k: string) => allAgg[k].victoires / allAgg[k].n;
  const maxWr = Math.max(...keys.map(wr));
  const reflechie = wr('reflechie');
  console.log('\n## Verdict');
  console.log(`- Meilleure stratégie : ${(maxWr * 100).toFixed(1)}% (aucune ne doit dominer totalement).`);
  console.log(`- Réfléchie : ${(reflechie * 100).toFixed(1)}% (cible 10-20%).`);
  console.log(`- Cible atteinte : ${reflechie >= 0.10 && reflechie <= 0.20 ? 'OUI' : 'à ajuster'}`);
}

main();
