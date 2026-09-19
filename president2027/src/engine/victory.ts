import type { GameState, EndInfo } from './types.ts';
import { clamp } from './constants.ts';

function bump(state: GameState, key: string, cond: boolean): number {
  const c = state.meta.dangerCounters;
  c[key] = cond ? (c[key] ?? 0) + 1 : 0;
  return c[key];
}

/**
 * Vérifie les conditions de fin (défaite immédiate). Renvoie un EndInfo si la
 * partie doit s'arrêter, sinon undefined. À appeler à la fin du tour.
 */
export function checkDefeat(state: GameState): EndInfo | undefined {
  const p = state.politics;
  const m = state.macro;

  // Démission forcée : popularité effondrée + capital nul, 3 tours.
  const demission = bump(state, 'demission', p.popularity < 15 && p.capital < 10);
  if (demission >= 3) return endDefeat(state, 'demission',
    'Démission forcée', 'Lâché par tous, sans capital politique ni soutien populaire, vous quittez l\'Élysée avant terme.');

  // Blocage : deux censures dans le mandat.
  if (p.censureCount >= 2) return endDefeat(state, 'blocage',
    'Blocage institutionnel', 'Deux gouvernements renversés : le pays est ingouvernable, la crise de régime est ouverte.');

  // Crise de la dette : dette > 150 % ou spread > 600 pendant 2 tours.
  const detteCrise = bump(state, 'dette', m.debtPct > 150 || m.spread > 600);
  if (detteCrise >= 2) return endDefeat(state, 'dette',
    'Crise de la dette souveraine', 'La France perd l\'accès aux marchés. Un plan d\'aide FMI/UE est imposé, sous conditions humiliantes.');

  // Troubles civils : tension > 92 pendant 2 tours.
  const troubles = bump(state, 'troubles', p.socialTension > 92);
  if (troubles >= 2) return endDefeat(state, 'troubles',
    'Troubles civils incontrôlables', 'Le pays s\'embrase. L\'état d\'urgence ne suffit plus, l\'autorité de l\'État vacille.');

  // Défaite militaire : moral de l'armée effondré alors qu'on est en guerre.
  if (state.intl.atWar.length > 0 && state.intl.armyMorale < 12) return endDefeat(state, 'guerre',
    'Défaite militaire', 'L\'engagement des armées tourne au désastre. Le revers militaire emporte le pouvoir politique.');

  return undefined;
}

function endDefeat(state: GameState, raison: string, titre: string, bilan: string): EndInfo {
  const sc = computeScore(state);
  return {
    victoire: false, raison, titre, note: sc.note, score: Math.min(sc.score, 45),
    bilan, objectifs: sc.objectifs,
  };
}

/** Objectifs de victoire (évalués en fin de partie ou à tout moment). */
export function objectifs(state: GameState): { label: string; atteint: boolean }[] {
  const m = state.macro;
  return [
    { label: 'Déficit sous 3 % du PIB', atteint: m.deficitPct < 3 },
    { label: 'Dette en baisse (< 116 % du PIB)', atteint: m.debtPct < 116 },
    { label: 'Plein-emploi (chômage < 5 %)', atteint: state.economy.unemployment < 5 },
    { label: 'Transition écologique (écologie > 70)', atteint: state.society.ecologie > 70 },
    { label: 'Cohésion nationale (> 65)', atteint: state.society.cohesion > 65 },
    { label: 'Réélu en 2027', atteint: state.meta.mandat >= 2 },
    { label: 'Réputation internationale (> 70)', atteint: state.intl.reputation > 70 },
  ];
}

/** Score global 0-100 + note + bilan « manuel d'histoire ». */
export function computeScore(state: GameState): EndInfo {
  const m = state.macro;
  const e = state.economy;
  const p = state.politics;

  // Finances : cœur du défi (comme le jeu d'origine). Récompense un déficit
  // maîtrisé et une dette contenue, punit sévèrement le dérapage.
  const finances = clamp(100 - (m.deficitPct - 3) * 9 - Math.max(0, m.debtPct - 112) * 1.4, 0, 100);
  const economie = clamp(52 + (e.growth - 1) * 12 - (e.unemployment - 7) * 5 + (e.purchasingPower - 50), 0, 100);
  const social = clamp(p.popularity * 0.5 + (100 - p.socialTension) * 0.3 + state.society.cohesion * 0.2, 0, 100);
  const international = clamp(state.intl.reputation * 0.6 + state.intl.europeWeight * 0.4, 0, 100);
  const societe = clamp(
    (state.society.sante + state.society.education + state.society.securite + state.society.ecologie) / 4, 0, 100);

  const objs = objectifs(state);
  const bonus = objs.filter((o) => o.atteint).length * 3;

  const score = clamp(
    finances * 0.33 + economie * 0.22 + social * 0.16 + international * 0.12 + societe * 0.17 + bonus,
    0, 100);

  const note =
    score >= 90 ? 'A+' : score >= 82 ? 'A' : score >= 74 ? 'B+' : score >= 64 ? 'B' :
    score >= 58 ? 'C+' : score >= 48 ? 'C' : score >= 38 ? 'D' : score >= 26 ? 'E' : 'F';

  // Victoire = bilan « B » ou mieux (redressement crédible et pays tenu).
  const bilan = redigerBilan(state, score, objs);
  return { victoire: score >= 64, raison: 'bilan', titre: 'Fin du mandat', note, score, bilan, objectifs: objs };
}

function redigerBilan(state: GameState, score: number, objs: { label: string; atteint: boolean }[]): string {
  const m = state.macro;
  const reelu = state.meta.mandat >= 2;
  const nbObj = objs.filter((o) => o.atteint).length;
  let t = '';
  if (score >= 80) {
    t = `Les manuels d'histoire retiendront un mandat de redressement. Déficit ramené à ${m.deficitPct.toFixed(1)} %, dette à ${m.debtPct.toFixed(0)} % du PIB. `;
  } else if (score >= 54) {
    t = `Un bilan honorable, sans rupture majeure. Le pays a tenu, sans être transformé. Déficit à ${m.deficitPct.toFixed(1)} %, dette à ${m.debtPct.toFixed(0)} %. `;
  } else if (score >= 36) {
    t = `Un mandat difficile, marqué par l'usure et les compromis. Déficit à ${m.deficitPct.toFixed(1)} %, dette à ${m.debtPct.toFixed(0)} %. `;
  } else {
    t = `Un mandat que l'Histoire jugera sévèrement. Comptes dégradés (déficit ${m.deficitPct.toFixed(1)} %, dette ${m.debtPct.toFixed(0)} %) et pays fracturé. `;
  }
  t += reelu ? 'La réélection de 2027 a été acquise. ' : '';
  t += `${nbObj} objectif(s) sur ${objs.length} atteint(s). `;
  if (state.intl.atWar.length > 0) t += 'La France est restée engagée militairement. ';
  return t;
}
