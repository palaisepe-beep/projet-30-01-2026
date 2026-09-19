import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, endTurn, cloneState, MEASURES, measureAvailability, applyMeasure,
  firstRound, secondRound, computeScore, GROUPS, FAMILLES, type GameState,
} from './index.ts';
import { createRng, hashSeed } from './rng.ts';
import { applyEffet, clampState } from './effects.ts';

function newGame(seed = 'TEST', profile: any = 'reformateur', diff: any = 'normal', mode: any = 'complet'): GameState {
  return createInitialState({ seed, profile, difficulty: diff, mode });
}

// --------------------------------------------------------------------------
test('RNG déterministe et reproductible', () => {
  const a = createRng('graine-x');
  const b = createRng('graine-x');
  const seqA = [a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next()];
  assert.deepEqual(seqA, seqB);
  assert.equal(hashSeed('graine-x'), hashSeed('graine-x'));
  assert.notEqual(hashSeed('a'), hashSeed('b'));
  for (const v of seqA) { assert.ok(v >= 0 && v < 1); }
});

test('Déterminisme du jeu : même graine + mêmes actions => états identiques', () => {
  const a = newGame('DET-42');
  const b = cloneState(a);
  for (let i = 0; i < 12; i++) { endTurn(a); endTurn(b); }
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('État de départ conforme aux ordres de grandeur', () => {
  const s = newGame();
  assert.ok(Math.abs(s.macro.deficitPct - 5.9) < 0.001);
  assert.ok(Math.abs(s.macro.debtPct - 118) < 0.5);
  assert.ok(s.macro.interestCharge > 55 && s.macro.interestCharge < 80);
  assert.equal(s.meta.year, 2026);
});

// --------------------------------------------------------------------------
test('Bornes : les jauges 0-100 restent dans [0,100] après effets extrêmes', () => {
  const s = newGame();
  // Effet monstrueux dans les deux sens.
  applyEffet(s, { politics: { popularity: 999, socialTension: -999, capital: 999 },
    groups: { jeunes: 999, retraites: -999 }, society: { sante: 999, ecologie: -999 },
    intl: { reputation: 999, armyMorale: -999 }, economy: { unemployment: 999, growth: 999 } });
  clampState(s);
  for (const g of GROUPS) assert.ok(s.politics.groups[g] >= 0 && s.politics.groups[g] <= 100);
  assert.ok(s.politics.popularity >= 0 && s.politics.popularity <= 100);
  assert.ok(s.politics.socialTension >= 0 && s.politics.socialTension <= 100);
  assert.ok(s.society.sante >= 0 && s.society.sante <= 100);
  assert.ok(s.economy.unemployment <= 16 && s.economy.unemployment >= 2.5);
  assert.ok(s.economy.growth <= 6 && s.economy.growth >= -6);
});

test('Bornes tenues sur 20 tours de jeu', () => {
  const s = newGame('LONG', 'technocrate', 'impitoyable', 'bacASable');
  for (let i = 0; i < 20 && s.meta.phase !== 'FIN'; i++) endTurn(s);
  for (const g of GROUPS) assert.ok(s.politics.groups[g] >= 0 && s.politics.groups[g] <= 100);
  assert.ok(s.macro.debt >= 0);
  assert.ok(s.macro.spread >= -20 && s.macro.spread <= 700);
});

// --------------------------------------------------------------------------
test('Causalité éco : austérité => déficit baisse mais croissance sous pression', () => {
  const s = newGame('AUST', 'reformateur', 'normal', 'bacASable');
  const g0 = s.economy.growth;
  // Consolidation forte (mesures à budget positif) sur plusieurs tours.
  for (let t = 0; t < 6; t++) {
    let guard = 0;
    while (s.politics.actionPoints > 0 && guard++ < 4) {
      const pool = MEASURES.filter((m) => !m.pouvoir && (m.effets?.budgetMdEUR ?? 0) > 2 && measureAvailability(s, m).ok);
      if (!pool.length) break;
      applyMeasure(s, pool[0]);
    }
    endTurn(s);
  }
  assert.ok(s.macro.deficitPct < 5.9, `déficit devrait baisser (=${s.macro.deficitPct})`);
  assert.ok(s.economy.growth <= g0 + 0.5, 'la croissance ne doit pas s\'envoler sous austérité');
});

test('Causalité éco : une hausse de taux augmente la charge de la dette', () => {
  const s = newGame();
  const charge0 = s.macro.interestCharge;
  applyEffet(s, { macro: { apparentRate: 1.0 } }); // +1 pt de taux apparent
  s.macro.interestCharge = (s.macro.apparentRate / 100) * s.macro.debt;
  assert.ok(s.macro.interestCharge > charge0);
});

test('Opinion : une mesure impopulaire fait chuter le groupe visé', () => {
  const s = newGame();
  const m = MEASURES.find((x) => x.id === 'retraite_indexation')!; // frappe les retraités
  const before = s.politics.groups.retraites;
  applyMeasure(s, m);
  assert.ok(s.politics.groups.retraites < before);
});

// --------------------------------------------------------------------------
test('Élections : reproductibles, parts ~100 %, 2d tour à 2 candidats', () => {
  const s1 = newGame('ELEC');
  const s2 = cloneState(s1);
  const r1 = firstRound(s1, createRng('e'));
  const r2 = firstRound(s2, createRng('e'));
  assert.equal(JSON.stringify(r1), JSON.stringify(r2));
  const sum = r1.candidats.reduce((a, c) => a + c.part, 0);
  assert.ok(Math.abs(sum - 100) < 0.01, `parts somment à ${sum}`);
  const second = secondRound(s1, r1, createRng('e'));
  assert.equal(second.candidats.length, 2);
  assert.ok(Math.abs(second.candidats[0].part + second.candidats[1].part - 100) < 0.01);
  assert.ok(second.candidats.every((c) => c.part >= 0 && c.part <= 100));
});

test('Élections : un bon bilan améliore le score du sortant', () => {
  const bon = newGame('B'); bon.politics.popularity = 70; bon.economy.purchasingPower = 70; bon.economy.unemployment = 4;
  const mauvais = newGame('B'); mauvais.politics.popularity = 20; mauvais.economy.purchasingPower = 30; mauvais.economy.unemployment = 12;
  const rBon = firstRound(bon, createRng('z'));
  const rMauvais = firstRound(mauvais, createRng('z'));
  const partBon = rBon.candidats.find((c) => c.joueur)!.part;
  const partMauvais = rMauvais.candidats.find((c) => c.joueur)!.part;
  assert.ok(partBon > partMauvais, `bon=${partBon} vs mauvais=${partMauvais}`);
});

// --------------------------------------------------------------------------
test('Défaite : crise de la dette (dette > 150 %) déclenche la fin', () => {
  const s = newGame('DEBT', 'tribun', 'normal', 'bacASable');
  s.macro.debt = s.macro.pib * 1.6; // 160 % du PIB
  clampState(s);
  endTurn(s); endTurn(s); // condition tenue 2 tours
  assert.equal(s.meta.phase, 'FIN');
  assert.equal(s.end?.raison, 'dette');
  assert.equal(s.end?.victoire, false);
});

test('Défaite : popularité effondrée => démission forcée', () => {
  const s = newGame('POP', 'tribun', 'normal', 'bacASable');
  for (let i = 0; i < 5 && s.meta.phase !== 'FIN'; i++) {
    s.politics.popularity = 5; s.politics.capital = 0;
    for (const g of GROUPS) s.politics.groups[g] = 5;
    endTurn(s);
  }
  assert.equal(s.meta.phase, 'FIN');
  assert.ok(['demission', 'blocage', 'troubles'].includes(s.end?.raison ?? ''));
});

test('Victoire : un excellent état donne un score élevé et une victoire', () => {
  const s = newGame();
  s.macro.deficitPct = 2; s.macro.debtPct = 108;
  s.economy.growth = 2.5; s.economy.unemployment = 4.5; s.economy.purchasingPower = 75;
  s.politics.popularity = 68; s.politics.socialTension = 20;
  s.society.sante = 75; s.society.education = 75; s.society.securite = 70; s.society.ecologie = 72;
  s.society.cohesion = 70; s.intl.reputation = 78; s.intl.europeWeight = 82; s.meta.mandat = 2;
  const sc = computeScore(s);
  assert.ok(sc.score >= 66, `score=${sc.score}`);
  assert.equal(sc.victoire, true);
});

test('Le jeu se termine toujours (pas de boucle infinie)', () => {
  const s = newGame('END', 'centre' as any === 'centre' ? 'ecologiste' : 'ecologiste', 'normal', 'complet');
  let guard = 0;
  while (s.meta.phase !== 'FIN' && guard++ < 100) endTurn(s);
  assert.ok(guard < 100, 'le jeu doit se terminer');
  assert.ok(s.end !== undefined);
});
