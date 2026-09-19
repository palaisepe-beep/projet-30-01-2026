import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEASURES, ALL_EVENTS, POWERS, PROFILES, CANDIDATS, PAYS, ACHIEVEMENTS, FAMILLES } from '../engine/index.ts';

test('Mesures : ids uniques', () => {
  const ids = MEASURES.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('Mesures : champ source_ou_ordre_de_grandeur présent et non vide', () => {
  for (const m of MEASURES) {
    assert.ok(m.source_ou_ordre_de_grandeur && m.source_ou_ordre_de_grandeur.length > 4, `manque source: ${m.id}`);
  }
});

test('Mesures : coûts cohérents et famille valide', () => {
  for (const m of MEASURES) {
    assert.ok(m.cout.capital >= 0 && m.cout.actionPoints >= 1, `coût invalide: ${m.id}`);
    assert.ok(FAMILLES.includes(m.famille), `famille invalide: ${m.id} (${m.famille})`);
    if (m.delaiTours) assert.ok(m.effetsDiffered, `delaiTours sans effetsDiffered: ${m.id}`);
  }
});

test('Mesures : diversité politique (chaque famille représentée)', () => {
  for (const f of FAMILLES) {
    assert.ok(MEASURES.some((m) => m.famille === f), `aucune mesure pour la famille ${f}`);
  }
});

test('Événements : ids uniques et source présente', () => {
  const ids = ALL_EVENTS.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const e of ALL_EVENTS) {
    assert.ok(e.source_ou_ordre_de_grandeur.length > 4, `manque source: ${e.id}`);
    assert.ok(e.choix.length >= 1, `événement sans choix: ${e.id}`);
  }
});

test('Événements : les chaînes (suite) pointent vers un événement existant', () => {
  const ids = new Set(ALL_EVENTS.map((e) => e.id));
  for (const e of ALL_EVENTS) {
    for (const c of e.choix) {
      if (c.suite) assert.ok(ids.has(c.suite), `suite orpheline: ${e.id} -> ${c.suite}`);
    }
  }
});

test('Pouvoirs : ids uniques et coûts valides', () => {
  const ids = POWERS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const p of POWERS) assert.ok(p.coutCapital >= 0 && p.coutActionPoints >= 1);
});

test('Profils : 5 profils, ids uniques', () => {
  assert.equal(PROFILES.length, 5);
  assert.equal(new Set(PROFILES.map((p) => p.id)).size, 5);
});

test('Candidats : positions dans [-1,1], familles valides', () => {
  for (const c of CANDIDATS) {
    for (const v of [c.econLeftRight, c.socialLibAuth, c.proEU]) assert.ok(v >= -1 && v <= 1);
    assert.ok(FAMILLES.includes(c.famille));
  }
});

test('Pays : relations de départ dans [-100,100]', () => {
  for (const p of PAYS) assert.ok(p.relationDepart >= -100 && p.relationDepart <= 100);
});

test('Succès : ids uniques', () => {
  const ids = ACHIEVEMENTS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});
