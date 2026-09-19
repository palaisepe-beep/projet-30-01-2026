import {
  createInitialState, endTurn, usePower, getEvent, resolveEventChoice, availableChoices,
  measureAvailability, applyMeasure, majoriteSoutien, risqueCensure, ratingLabel,
  MEASURES, POWERS, PROFILES, PARTIS, CONSEILLERS, ACHIEVEMENTS, achievementById,
  GROUPS, FAMILLES, MAJORITE_ABSOLUE,
  type GameState, type ProfileId, type Difficulty, type Mode, type Domaine, type Measure,
} from '../engine/index.ts';
import { createRng, hashSeed } from '../engine/rng.ts';
import { lineChart } from './charts.ts';
import {
  GROUP_LABEL, FAMILLE_LABEL, FAMILLE_COLOR, DOMAINE_LABEL, SOCIETY_LABEL, esc,
} from './labels.ts';

const SAVE_KEY = 'p2027_save';
const SCORES_KEY = 'p2027_scores';
const THEME_KEY = 'p2027_theme';

// --------------------------------------------------------------------------
// État de l'interface
// --------------------------------------------------------------------------
type Screen = 'home' | 'game' | 'end';
type UIState = {
  screen: Screen;
  filter: Domaine | 'all' | 'pouvoirs' | 'favoris';
  search: string;
  pedago: boolean;
  newOpts: { seed: string; profile: ProfileId; difficulty: Difficulty; mode: Mode };
};

let game: GameState | null = null;
const ui: UIState = {
  screen: 'home', filter: 'all', search: '', pedago: false,
  newOpts: { seed: randomSeed(), profile: 'reformateur', difficulty: 'normal', mode: 'complet' },
};

const app = document.getElementById('app')!;

// --------------------------------------------------------------------------
// Persistance
// --------------------------------------------------------------------------
function save(): void {
  if (!game) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); } catch { /* mode privé */ }
}
function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) as GameState : null;
  } catch { return null; }
}
function recordScore(): void {
  if (!game?.end) return;
  try {
    const scores = JSON.parse(localStorage.getItem(SCORES_KEY) ?? '[]');
    scores.push({ seed: game.meta.seed, profile: game.meta.profile, difficulty: game.meta.difficulty,
      score: Math.round(game.end.score), note: game.end.note, victoire: game.end.victoire,
      date: new Date().toISOString().slice(0, 10) });
    scores.sort((a: any, b: any) => b.score - a.score);
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, 20)));
  } catch { /* ignore */ }
}
function getScores(): any[] { try { return JSON.parse(localStorage.getItem(SCORES_KEY) ?? '[]'); } catch { return []; } }

function randomSeed(): string {
  const mots = ['ELYSEE', 'MARIANNE', 'RÉPUBLIQUE', 'BERCY', 'MATIGNON', 'CONCORDE', 'SÉNAT', 'PALAIS'];
  const m = mots[Math.floor(Math.random() * mots.length)];
  return `${m}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// --------------------------------------------------------------------------
// Thème
// --------------------------------------------------------------------------
function initTheme(): void {
  try { const t = localStorage.getItem(THEME_KEY); if (t) document.documentElement.setAttribute('data-theme', t); } catch { /* */ }
}
function toggleTheme(): void {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* */ }
}

// --------------------------------------------------------------------------
// Utilitaires d'affichage
// --------------------------------------------------------------------------
function fmt(n: number, d = 1): string { return n.toFixed(d); }
function barColor(v: number, invert = false): string {
  const good = invert ? 100 - v : v;
  return good > 60 ? 'var(--ok)' : good > 35 ? 'var(--warn)' : 'var(--danger)';
}
function gaugeBar(v: number, invert = false): string {
  return `<div class="bar"><span style="width:${Math.max(0, Math.min(100, v))}%;background:${barColor(v, invert)}"></span></div>`;
}

// --------------------------------------------------------------------------
// Rendu — routeur
// --------------------------------------------------------------------------
function render(): void {
  if (ui.screen === 'home') app.innerHTML = renderHome();
  else if (ui.screen === 'end') app.innerHTML = renderEnd();
  else app.innerHTML = renderGame();
  window.scrollTo({ top: 0 });
}

// --------------------------------------------------------------------------
// Écran d'accueil
// --------------------------------------------------------------------------
function renderHome(): string {
  const hasSave = !!loadSave();
  const profileCards = PROFILES.map((p) => `
    <button class="opt ${ui.newOpts.profile === p.id ? 'selected' : ''}" data-profile="${p.id}" aria-pressed="${ui.newOpts.profile === p.id}">
      <div class="emoji">${p.emoji}</div>
      <div class="nom">${esc(p.nom)}</div>
      <div class="role">${esc(p.description)}</div>
      <div class="fw"><b>+ ${esc(p.force)}</b><br><i>− ${esc(p.faiblesse)}</i></div>
    </button>`).join('');
  const diffs: [Difficulty, string, string][] = [
    ['facile', 'Facile', 'Marges confortables, marchés indulgents.'],
    ['normal', 'Normal', 'Équilibre de référence.'],
    ['realiste', 'Réaliste', 'Marchés nerveux, opinion volatile.'],
    ['impitoyable', 'Impitoyable', 'Chocs violents, aucune marge.'],
  ];
  const diffCards = diffs.map(([id, nom, d]) => `
    <button class="opt ${ui.newOpts.difficulty === id ? 'selected' : ''}" data-difficulty="${id}">
      <div class="nom">${nom}</div><div class="role">${d}</div></button>`).join('');
  const modes: [Mode, string, string][] = [
    ['complet', 'Complet', 'De 2026 à la fin du mandat suivant (2032).'],
    ['campagne', 'Campagne uniquement', 'Jusqu\'à la présidentielle de 2027.'],
    ['bacASable', 'Bac à sable', 'Gouverner sans élection, jusqu\'en 2032.'],
  ];
  const modeCards = modes.map(([id, nom, d]) => `
    <button class="opt ${ui.newOpts.mode === id ? 'selected' : ''}" data-mode="${id}">
      <div class="nom">${nom}</div><div class="role">${d}</div></button>`).join('');

  const scores = getScores();
  const scoreList = scores.length ? `<ol>${scores.slice(0, 8).map((s: any) =>
    `<li>${s.victoire ? '🏆' : '—'} <b>${s.note}</b> (${s.score}) · ${esc(s.profile)} · ${esc(s.difficulty)} · <span class="muted small">${esc(s.seed)}</span></li>`).join('')}</ol>`
    : '<p class="muted small">Aucune partie enregistrée pour l\'instant.</p>';

  return `<div class="tricolore"></div>
  <div class="home wrap">
    <div class="hero">
      <h1>Président 2027</h1>
      <p class="lead">Vous êtes Président de la République, à l'automne 2026. Déficit à 5,9 % du PIB,
      dette à 118 %, Assemblée sans majorité, Bruxelles et les agences qui surveillent, une guerre à l'Est.
      La présidentielle de 2027 approche. À vous de jouer — et de durer.</p>
      <div class="row" style="justify-content:center">
        <button class="btn ghost small" data-act="toggle-theme">🌓 Thème</button>
      </div>
    </div>

    <div class="card">
      <h2>1 · Choisissez votre profil</h2>
      <div class="options-grid">${profileCards}</div>
    </div>

    <div class="card">
      <h2>2 · Difficulté</h2>
      <div class="options-grid">${diffCards}</div>
    </div>

    <div class="card">
      <h2>3 · Mode de jeu</h2>
      <div class="options-grid">${modeCards}</div>
    </div>

    <div class="card">
      <h2>4 · Graine aléatoire (partageable)</h2>
      <div class="field">
        <label for="seedInput">Même graine + mêmes décisions = même partie. Partagez-la pour défier vos amis.</label>
        <div class="row">
          <input id="seedInput" type="text" value="${esc(ui.newOpts.seed)}" aria-label="Graine aléatoire" />
          <button class="btn small" data-act="reroll-seed">🎲 Aléatoire</button>
        </div>
      </div>
      <div class="row" style="margin-top:16px">
        <button class="btn primary" data-act="start">▶️ Commencer le mandat</button>
        ${hasSave ? '<button class="btn" data-act="resume">⏵ Reprendre la partie sauvegardée</button>' : ''}
        <button class="btn ghost" data-act="import">📂 Importer une sauvegarde</button>
      </div>
    </div>

    <div class="card">
      <h2>🏅 Meilleures parties (local)</h2>
      ${scoreList}
    </div>

    ${aboutBlock()}
    <p class="foot">Personnages et partis <b>fictifs</b>. Chiffres en ordres de grandeur. Ce jeu est une simplification, pas une prédiction.</p>
  </div>`;
}

function aboutBlock(): string {
  return `<div class="card"><details class="about">
    <summary>ℹ️ À propos & mentions</summary>
    <p class="small">« Président 2027 » est un jeu pédagogique. Le moteur modélise de façon <b>simplifiée</b>
    des liens économiques et politiques plausibles ; les nombres sont des <b>ordres de grandeur</b> calés sur
    la réalité budgétaire française (PIB ~3 000 Md€, dette ~3 500 Md€, charge de la dette ~60-70 Md€/an).
    Les institutions sont réelles, mais <b>tous les personnages, partis et dirigeants sont fictifs</b> et
    ne visent aucune personne réelle. Ce n'est <b>pas une prédiction</b>. Inspiré de « La Bataille du Budget ».</p>
    <p class="small">Sauvegarde automatique locale (aucune donnée envoyée). Chaque mesure affiche sa source ou
    son ordre de grandeur. Bon mandat.</p>
  </details></div>`;
}

// --------------------------------------------------------------------------
// Écran de jeu
// --------------------------------------------------------------------------
function renderGame(): string {
  const s = game!;
  const m = s.macro, e = s.economy, p = s.politics;
  const eventsPending = s.currentEvents.length > 0;

  return `<div class="tricolore"></div>
  <header class="topbar"><div class="topbar-row wrap">
    <span class="brand">Président 2027</span>
    <span class="date-pill">${esc(s.meta.dateLabel)}</span>
    <span class="phase-pill">${phaseLabel(s)}</span>
    <span class="topbar-spacer"></span>
    <span class="resources">
      <span class="res" title="Capital politique">💪 <b>${Math.round(p.capital)}</b></span>
      <span class="res" title="Points d'action ce tour">⏱️ <b>${p.actionPoints}/${p.maxActionPoints}</b></span>
      <span class="res" title="Popularité">📊 <b>${Math.round(p.popularity)}%</b></span>
    </span>
    <button class="btn ghost small" data-act="toggle-theme" aria-label="Changer de thème">🌓</button>
    <button class="btn ghost small" data-act="menu">☰ Menu</button>
  </div></header>

  <div class="wrap"><div class="layout">
    <main>
      ${eventsPending ? renderEvents(s) : ''}
      ${ui.pedago && s.explain.length ? renderPedago(s) : ''}
      <div class="card">
        <h2>📰 Briefing — ${esc(s.meta.dateLabel)}</h2>
        ${s.depeches.length ? s.depeches.map((d) => `<div class="depeche">${esc(d)}</div>`).join('')
          : '<p class="muted">Trimestre calme. À vous d\'agir.</p>'}
      </div>
      ${renderActions(s)}
    </main>
    <aside>
      ${renderDashboard(s)}
      ${renderCharts(s)}
      ${renderAssembly(s)}
      ${renderSondage(s)}
      ${renderAdvisors(s)}
      ${renderJournal(s)}
    </aside>
  </div></div>

  <div class="actionbar"><div class="wrap">
    <label class="toggle"><input type="checkbox" data-act="toggle-pedago" ${ui.pedago ? 'checked' : ''}/> Mode pédagogique</label>
    <span class="info">${eventsPending ? '⚠️ Traitez le(s) événement(s) avant de terminer.' : `Capital ${Math.round(p.capital)} · Points d'action ${p.actionPoints}`}</span>
    <span class="topbar-spacer"></span>
    <button class="btn primary" data-act="end-turn" ${eventsPending ? 'disabled' : ''}>Terminer ${s.meta.phase === 'CAMPAGNE' ? 'le mois' : 'le trimestre'} ▶</button>
  </div></div>`;
}

function phaseLabel(s: GameState): string {
  if (s.meta.phase === 'CAMPAGNE') return 'Campagne';
  if (s.meta.phase === 'ELECTION') return 'Élection';
  return s.politics.cohabitation ? `Mandat ${s.meta.mandat} · Cohabitation` : `Mandat ${s.meta.mandat}`;
}

function renderDashboard(s: GameState): string {
  const m = s.macro, e = s.economy, p = s.politics;
  const g = (lbl: string, val: string, bar?: string) =>
    `<div class="gauge"><div class="lbl">${lbl}</div><div class="val">${val}</div>${bar ?? ''}</div>`;
  return `<div class="card"><h2>📈 Tableau de bord</h2><div class="gauges">
    ${g('Déficit', `${fmt(m.deficitPct)}<small>% PIB</small>`, gaugeBar(100 - (m.deficitPct / 14) * 100))}
    ${g('Dette', `${fmt(m.debtPct, 0)}<small>% PIB</small>`, gaugeBar(100 - (m.debtPct - 90) * 1.6))}
    ${g('Charge dette', `${fmt(m.interestCharge, 0)}<small>Md€/an</small>`)}
    ${g('Croissance', `${fmt(e.growth)}<small>%</small>`, gaugeBar((e.growth + 2) * 20))}
    ${g('Chômage', `${fmt(e.unemployment)}<small>%</small>`, gaugeBar(100 - (e.unemployment - 3) * 8))}
    ${g('Inflation', `${fmt(e.inflation)}<small>%</small>`, gaugeBar(100 - Math.abs(e.inflation - 2) * 20))}
    ${g('Spread', `${fmt(m.spread, 0)}<small>bps</small>`, gaugeBar(100 - m.spread / 4))}
    ${g('Pouvoir d\'achat', `${fmt(e.purchasingPower, 0)}`, gaugeBar(e.purchasingPower))}
    ${g('Tension sociale', `${fmt(p.socialTension, 0)}`, gaugeBar(p.socialTension, true))}
    ${g('Notation (S&P)', ratingLabel(m.ratings.sp))}
  </div>
  <p class="small muted" style="margin-top:8px">Réputation internationale ${fmt(s.intl.reputation, 0)} · Poids en Europe ${fmt(s.intl.europeWeight, 0)} · Armée ${fmt(s.intl.armyStrength, 0)} · Munitions ${fmt(s.intl.ammoStock, 0)}</p>
  </div>`;
}

function renderCharts(s: GameState): string {
  const h = s.history;
  return `<div class="card"><h2>📉 Historique</h2><div class="chart-grid">
    <div class="chart-box"><div class="t">Déficit (% PIB)</div>${lineChart(h, (x) => x.deficitPct, { color: '#c0261f', unit: '%', title: 'Déficit', invert: true })}</div>
    <div class="chart-box"><div class="t">Dette (% PIB)</div>${lineChart(h, (x) => x.debtPct, { color: '#8e44ad', unit: '%', title: 'Dette', invert: true })}</div>
    <div class="chart-box"><div class="t">Popularité</div>${lineChart(h, (x) => x.popularity, { color: '#2e5cff', unit: '', title: 'Popularité' })}</div>
    <div class="chart-box"><div class="t">Croissance (%)</div>${lineChart(h, (x) => x.growth, { color: '#1f8a4c', unit: '%', title: 'Croissance' })}</div>
  </div></div>`;
}

function renderAssembly(s: GameState): string {
  const maj = majoriteSoutien(s);
  const risk = risqueCensure(s);
  const rows = FAMILLES.map((f) => {
    const seats = s.politics.assembly.seats[f];
    const sup = s.politics.assembly.support[f];
    return `<div class="advisor" style="border:none;padding:3px 0">
      <div style="flex:1"><span class="fam-tag" style="background:${FAMILLE_COLOR[f]}">${FAMILLE_LABEL[f]}</span>
      <span class="small muted"> ${seats} sièges</span></div>
      <div class="small">soutien ${Math.round(sup)}%</div></div>`;
  }).join('');
  return `<div class="card"><h2>🏛️ Assemblée</h2>
    <p class="small">Soutien présidentiel : <b>${maj}</b> / ${MAJORITE_ABSOLUE} sièges requis.
    Risque de censure : <b style="color:${risk > 55 ? 'var(--danger)' : risk > 30 ? 'var(--warn)' : 'var(--ok)'}">${Math.round(risk)}%</b></p>
    ${rows}</div>`;
}

function renderSondage(s: GameState): string {
  const rows = GROUPS.map((gr) => {
    const v = s.politics.groups[gr];
    return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
      <div style="width:120px;font-size:.8rem">${GROUP_LABEL[gr]}</div>
      <div class="bar" style="flex:1"><span style="width:${v}%;background:${barColor(v)}"></span></div>
      <div class="small" style="width:34px;text-align:right">${Math.round(v)}%</div></div>`;
  }).join('');
  return `<div class="card"><h2>📊 Sondage par catégorie</h2>${rows}</div>`;
}

function renderAdvisors(s: GameState): string {
  const msgs = advisorMessages(s);
  return `<div class="card"><h2>🗣️ Conseillers</h2>
    <p class="small muted">Leurs avis divergent — et ne sont pas toujours justes.</p>
    ${msgs.map((mm) => `<div class="advisor"><div class="emoji">${mm.emoji}</div>
      <div><div class="who">${esc(mm.who)}</div><div class="say">« ${esc(mm.say)} »</div></div></div>`).join('')}</div>`;
}

function renderJournal(s: GameState): string {
  const items = s.journal.slice(-40).reverse().map((j) =>
    `<li><span class="jt">${esc(j.label)}</span>${esc(j.texte)}</li>`).join('');
  return `<div class="card"><h2>📓 Journal de mandat</h2><ul class="journal-list">${items}</ul></div>`;
}

function renderPedago(s: GameState): string {
  const items = s.explain.filter((x) => Math.abs(x.delta) > 0.01 || x.raison)
    .map((x) => `<li><b>${esc(x.label)}</b> ${x.delta > 0 ? '▲' : x.delta < 0 ? '▼' : ''} ${x.delta ? fmt(x.delta) : ''} — ${esc(x.raison)}</li>`).join('');
  return `<div class="card"><h2>🎓 Pourquoi les chiffres ont bougé</h2><ul class="pedago">${items}</ul></div>`;
}

// --------------------------------------------------------------------------
// Événements
// --------------------------------------------------------------------------
function renderEvents(s: GameState): string {
  return s.currentEvents.map((id) => {
    const ev = getEvent(id);
    if (!ev) return '';
    const choices = availableChoices(s, ev);
    const btns = choices.map((i) => {
      const c = ev.choix[i];
      const cost = c.cout?.capital ? ` <span class="chip cost">−${c.cout.capital} 💪</span>` : '';
      return `<button class="btn" data-act="event-choice" data-ev="${ev.id}" data-idx="${i}">${esc(c.label)}${cost}</button>`;
    }).join('');
    return `<div class="event">
      <div class="cat">${ev.categorie}</div>
      <h3>${esc(ev.titre)}</h3>
      <p>${esc(ev.texte)}</p>
      <div class="choices">${btns}</div>
      <p class="small src muted" style="margin-top:8px">ⓘ ${esc(ev.source_ou_ordre_de_grandeur)}</p>
    </div>`;
  }).join('');
}

// --------------------------------------------------------------------------
// Actions (mesures + pouvoirs)
// --------------------------------------------------------------------------
const DOMAINES_ORDRE: Domaine[] = ['budget', 'fiscalite', 'social', 'dette', 'economie', 'energie',
  'ecologie', 'sante', 'education', 'securite', 'justice', 'immigration', 'europe', 'diplomatie',
  'defense', 'communication', 'institutions', 'interieur'];

function renderActions(s: GameState): string {
  const tabs = [`<button class="tab ${ui.filter === 'all' ? 'active' : ''}" data-filter="all">Toutes</button>`,
    `<button class="tab ${ui.filter === 'pouvoirs' ? 'active' : ''}" data-filter="pouvoirs">⚡ Pouvoirs</button>`];
  const usedDomains = new Set(MEASURES.map((m) => m.domaine));
  for (const d of DOMAINES_ORDRE) {
    if (!usedDomains.has(d)) continue;
    tabs.push(`<button class="tab ${ui.filter === d ? 'active' : ''}" data-filter="${d}">${DOMAINE_LABEL[d]}</button>`);
  }

  let body = '';
  if (ui.filter === 'pouvoirs') {
    body = POWERS.map((pw) => {
      const enough = s.politics.capital >= pw.coutCapital && s.politics.actionPoints >= pw.coutActionPoints;
      return `<div class="measure ${enough ? '' : 'locked'}">
        <div class="measure-head"><div class="measure-title">${pw.emoji} ${esc(pw.titre)}</div>
        <span class="chip cost">${pw.coutCapital} 💪 · ${pw.coutActionPoints} ⏱️</span></div>
        <div class="desc">${esc(pw.description)}</div>
        <div class="meta">${pw.risque ? `<span class="chip" style="color:var(--danger)">⚠️ ${esc(pw.risque)}</span>` : ''}
        <span class="chip src">ⓘ ${esc(pw.source_ou_ordre_de_grandeur)}</span>
        <button class="btn small primary" data-act="use-power" data-id="${pw.id}" ${enough ? '' : 'disabled'}>Utiliser</button></div>
      </div>`;
    }).join('');
  } else {
    const q = ui.search.trim().toLowerCase();
    const list = MEASURES.filter((mm) => {
      if (ui.filter !== 'all' && mm.domaine !== ui.filter) return false;
      if (q && !(`${mm.titre} ${mm.description}`.toLowerCase().includes(q))) return false;
      return true;
    });
    body = list.length ? list.map((mm) => renderMeasure(s, mm)).join('')
      : '<p class="muted">Aucune mesure ne correspond.</p>';
  }

  return `<div class="card"><h2>🎯 Leviers d'action</h2>
    <div class="tabs">${tabs.join('')}</div>
    ${ui.filter !== 'pouvoirs' ? `<input class="search" type="search" placeholder="Rechercher une mesure…" value="${esc(ui.search)}" data-act="search" aria-label="Rechercher une mesure" />` : ''}
    ${body}
  </div>`;
}

function renderMeasure(s: GameState, mm: Measure): string {
  const av = measureAvailability(s, mm);
  const cohab = s.politics.cohabitation;
  const budget = mm.effets?.budgetMdEUR ?? 0;
  const budgetLong = mm.effetsDiffered?.budgetMdEUR ?? 0;
  const budgetChip = budget || budgetLong
    ? `<span class="chip" title="Impact sur le solde public">${budget >= 0 ? '💰' : '💸'} ${budget ? `${budget > 0 ? '+' : ''}${budget} Md€` : ''}${budgetLong ? ` (+${budgetLong} Md€ différé)` : ''}</span>` : '';
  const delai = mm.delaiTours ? `<span class="chip">⏳ effet dans ${mm.delaiTours} tr.</span>` : '';
  const oneshot = mm.oneShot ? '<span class="chip">unique</span>' : '';
  const risques = (mm.risques ?? []).map((r) => `<span class="chip" style="color:var(--warn)">⚠️ ${esc(r)}</span>`).join('');
  return `<div class="measure ${av.ok ? '' : 'locked'}">
    <div class="measure-head">
      <div class="measure-title">${esc(mm.titre)} <span class="fam-tag" style="background:${FAMILLE_COLOR[mm.famille]}">${FAMILLE_LABEL[mm.famille]}</span></div>
      <span class="chip cost">${mm.cout.capital} 💪 · ${mm.cout.actionPoints} ⏱️</span>
    </div>
    <div class="desc">${esc(mm.description)}</div>
    <div class="meta">${budgetChip}${delai}${oneshot}${risques}
      <span class="chip src">ⓘ ${esc(mm.source_ou_ordre_de_grandeur)}</span>
      <button class="btn small primary" data-act="apply-measure" data-id="${mm.id}" ${av.ok ? '' : 'disabled'}>${av.ok ? 'Décider' : esc(av.raison ?? 'Indisponible')}</button>
    </div>
    ${cohab && !av.ok ? '' : ''}
  </div>`;
}

// --------------------------------------------------------------------------
// Conseillers (avis parfois faux)
// --------------------------------------------------------------------------
function advisorMessages(s: GameState): { emoji: string; who: string; say: string }[] {
  const rng = createRng(s.meta.advisorBiasSeed + s.meta.turn * 101);
  const out: { emoji: string; who: string; say: string }[] = [];
  const pool = CONSEILLERS.slice();
  // 3 conseillers du tour.
  for (let k = 0; k < 3 && pool.length; k++) {
    const idx = Math.floor(rng.next() * pool.length);
    const c = pool.splice(idx, 1)[0];
    const reliable = rng.next() > 0.28; // ~28 % d'avis trompeurs
    out.push({ emoji: c.emoji, who: `${c.nom} — ${c.poste}`, say: advisorLine(s, c.id, reliable, rng) });
  }
  return out;
}

function advisorLine(s: GameState, id: string, reliable: boolean, rng: any): string {
  const m = s.macro, e = s.economy, p = s.politics;
  const truthful = (t: string, f: string) => (reliable ? t : f);
  switch (id) {
    case 'finances':
      return m.deficitPct > 4.5
        ? truthful(`Le déficit à ${fmt(m.deficitPct)} % est intenable, il faut couper dans la dépense.`, `Le déficit ? Un détail, la croissance réglera tout.`)
        : truthful(`Les comptes se redressent, tenons le cap.`, `Attention, tout peut basculer d'un instant à l'autre !`);
    case 'matignon':
      return p.socialTension > 60
        ? truthful(`La rue gronde, une concession serait sage avant l'explosion.`, `La contestation va s'essouffler d'elle-même, ne cédez rien.`)
        : truthful(`Le climat social est gérable pour l'instant.`, `Je sens une révolte imminente, méfiez-vous.`);
    case 'diplo':
      return truthful(`Un geste vers Berlin renforcerait notre poids européen.`, `Nos partenaires nous suivront quoi qu'il arrive, pas d'inquiétude.`);
    case 'armees':
      return s.intl.ammoStock < 40
        ? truthful(`Nos stocks de munitions sont bas, il faut réinvestir.`, `Nos armées sont prêtes à tout, aucun souci de matériel.`)
        : truthful(`Nos capacités sont correctes, mais l'effort doit durer.`, `Il faudrait frapper un grand coup pour asseoir notre autorité.`);
    case 'com':
      return p.popularity < 40
        ? truthful(`Votre image est dégradée, une prise de parole s'impose.`, `Les sondages ne veulent rien dire, ignorez-les.`)
        : truthful(`L'opinion vous est plutôt favorable, capitalisez.`, `Attention au retournement, tout est fragile.`);
    case 'sondages':
      return truthful(`Nos études donnent une popularité autour de ${Math.round(p.popularity)} %.`,
        `Nos études donnent une popularité autour de ${Math.round(Math.max(0, Math.min(100, p.popularity + (rng.next() - 0.5) * 30)))} %.`);
    default: return 'Rien à signaler.';
  }
}

// --------------------------------------------------------------------------
// Écran de fin
// --------------------------------------------------------------------------
function renderEnd(): string {
  const s = game!;
  const end = s.end!;
  const win = end.victoire;
  const objs = end.objectifs.map((o) => `<li class="${o.atteint ? 'obj-ok' : 'obj-no'}">${esc(o.label)}</li>`).join('');
  const achs = s.meta.achievements.map((id) => { const a = achievementById(id); return a ? `<span class="ach">${a.emoji} ${esc(a.nom)}</span>` : ''; }).join('');
  const card = shareCard(s);
  return `<div class="tricolore"></div>
  <div class="wrap" style="padding-top:24px;padding-bottom:60px">
    <div class="end-hero">
      <div class="note-badge ${win ? 'win' : 'lose'}">${end.note}</div>
      <h1 style="margin-top:14px">${win ? '🏆 ' : ''}${esc(end.titre)}</h1>
      <p class="lead">${esc(end.bilan)}</p>
      <p class="muted">Score global : <b>${Math.round(end.score)}/100</b> · ${esc(s.meta.dateLabel)} · Graine ${esc(s.meta.seed)}</p>
    </div>
    <div class="card"><h2>🎯 Objectifs</h2><ul class="obj-list">${objs}</ul></div>
    ${achs ? `<div class="card"><h2>🏅 Succès débloqués</h2>${achs}</div>` : ''}
    <div class="card"><h2>📤 Carte de résultats partageable</h2>
      <div class="share-card" id="shareCard">${esc(card)}</div>
      <div class="row" style="margin-top:10px">
        <button class="btn primary" data-act="copy-share">📋 Copier</button>
        <button class="btn" data-act="export">💾 Exporter la sauvegarde</button>
      </div>
    </div>
    <div class="row" style="justify-content:center;margin-top:16px">
      <button class="btn primary" data-act="new-game">🔄 Nouvelle partie</button>
    </div>
    ${aboutBlock()}
  </div>`;
}

function shareCard(s: GameState): string {
  const end = s.end!;
  const bars = (v: number) => { const n = Math.round(v / 10); return '█'.repeat(n) + '░'.repeat(10 - n); };
  return `🇫🇷 PRÉSIDENT 2027 — Bilan\n`
    + `Profil : ${PROFILES.find((p) => p.id === s.meta.profile)?.nom}\n`
    + `Note : ${end.note}  (${Math.round(end.score)}/100)  ${end.victoire ? '🏆 VICTOIRE' : '❌'}\n`
    + `${end.titre}\n`
    + `Déficit ${fmt(s.macro.deficitPct)}%  Dette ${fmt(s.macro.debtPct, 0)}%\n`
    + `Popularité  ${bars(s.politics.popularity)} ${Math.round(s.politics.popularity)}%\n`
    + `Chômage ${fmt(s.economy.unemployment)}%  Croissance ${fmt(s.economy.growth)}%\n`
    + `Mandat(s) : ${s.meta.mandat}  ·  Objectifs : ${end.objectifs.filter((o) => o.atteint).length}/${end.objectifs.length}\n`
    + `Graine : ${s.meta.seed} (${s.meta.difficulty})\n`
    + `À vous de faire mieux !`;
}

// --------------------------------------------------------------------------
// Actions utilisateur (délégation d'événements)
// --------------------------------------------------------------------------
function startGame(): void {
  const seedEl = document.getElementById('seedInput') as HTMLInputElement | null;
  if (seedEl && seedEl.value.trim()) ui.newOpts.seed = seedEl.value.trim();
  game = createInitialState({ ...ui.newOpts });
  ui.screen = 'game';
  save();
  render();
}

function afterAction(): void {
  save();
  render();
}

function doEndTurn(): void {
  if (!game) return;
  endTurn(game);
  save();
  if (game.meta.phase === 'FIN') { recordScore(); ui.screen = 'end'; }
  render();
}

function exportSave(): void {
  if (!game) return;
  const blob = new Blob([JSON.stringify(game, null, 0)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `president2027-${game.meta.seed}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function importSave(): void {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'application/json';
  input.onchange = () => {
    const file = input.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        game = JSON.parse(String(reader.result)) as GameState;
        ui.screen = game.meta.phase === 'FIN' ? 'end' : 'game';
        save(); render();
      } catch { alert('Fichier de sauvegarde invalide.'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

document.addEventListener('click', (ev) => {
  const t = (ev.target as HTMLElement).closest('[data-act],[data-profile],[data-difficulty],[data-mode],[data-filter]') as HTMLElement | null;
  if (!t) return;
  // Sélections d'accueil
  if (t.dataset.profile) { ui.newOpts.profile = t.dataset.profile as ProfileId; return render(); }
  if (t.dataset.difficulty) { ui.newOpts.difficulty = t.dataset.difficulty as Difficulty; return render(); }
  if (t.dataset.mode) { ui.newOpts.mode = t.dataset.mode as Mode; return render(); }
  if (t.dataset.filter) { ui.filter = t.dataset.filter as any; return render(); }

  const act = t.dataset.act;
  switch (act) {
    case 'start': return startGame();
    case 'resume': { const sv = loadSave(); if (sv) { game = sv; ui.screen = sv.meta.phase === 'FIN' ? 'end' : 'game'; render(); } return; }
    case 'reroll-seed': { ui.newOpts.seed = randomSeed(); return render(); }
    case 'toggle-theme': return toggleTheme();
    case 'import': return importSave();
    case 'export': return exportSave();
    case 'new-game': { ui.newOpts.seed = randomSeed(); ui.screen = 'home'; game = null; return render(); }
    case 'menu': { if (confirm('Retour à l\'accueil ? (la partie reste sauvegardée)')) { ui.screen = 'home'; render(); } return; }
    case 'end-turn': return doEndTurn();
    case 'toggle-pedago': { ui.pedago = !ui.pedago; return render(); }
    case 'apply-measure': {
      if (!game) return; const m = MEASURES.find((x) => x.id === t.dataset.id);
      if (m && measureAvailability(game, m).ok) { applyMeasure(game, m); afterAction(); } return;
    }
    case 'use-power': {
      if (!game) return; const r = usePower(game, t.dataset.id!);
      if (!r.ok) alert(r.message); afterAction(); return;
    }
    case 'event-choice': {
      if (!game) return; const evObj = getEvent(t.dataset.ev!);
      if (evObj) {
        resolveEventChoice(game, evObj, parseInt(t.dataset.idx!, 10));
        game.currentEvents = game.currentEvents.filter((id) => id !== t.dataset.ev);
      }
      afterAction(); return;
    }
    case 'copy-share': {
      const el = document.getElementById('shareCard');
      if (el) navigator.clipboard?.writeText(el.textContent ?? '').then(
        () => { (t as HTMLButtonElement).textContent = '✓ Copié !'; },
        () => alert('Copie impossible — sélectionnez le texte manuellement.'));
      return;
    }
  }
});

// Recherche (input) + graine (saisie)
document.addEventListener('input', (ev) => {
  const t = ev.target as HTMLElement;
  if ((t as HTMLInputElement).dataset?.act === 'search') {
    ui.search = (t as HTMLInputElement).value;
    // Re-render en préservant le focus/curseur du champ.
    const val = ui.search;
    render();
    const again = document.querySelector('[data-act="search"]') as HTMLInputElement | null;
    if (again) { again.focus(); again.value = val; again.setSelectionRange(val.length, val.length); }
  }
  if (t.id === 'seedInput') ui.newOpts.seed = (t as HTMLInputElement).value;
});

// Navigation clavier : « n » pour terminer le tour.
document.addEventListener('keydown', (ev) => {
  if (ui.screen !== 'game' || !game) return;
  const tag = (ev.target as HTMLElement).tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (ev.key === 'Enter' && game.currentEvents.length === 0) { ev.preventDefault(); doEndTurn(); }
});

// --------------------------------------------------------------------------
// Démarrage
// --------------------------------------------------------------------------
initTheme();
render();
