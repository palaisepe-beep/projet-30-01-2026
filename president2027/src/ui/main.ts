import {
  createInitialState, endTurn, usePower, getEvent, resolveEventChoice, availableChoices,
  measureAvailability, applyMeasure, majoriteSoutien, risqueCensure, ratingLabel,
  projectedDeficit, measureDeficitDelta, measureBudgetMdEUR, turnBudgetTally,
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
  open: Set<string>;         // panneaux/mesures dépliés (persiste au re-render)
  tutorial: boolean;         // overlay tutoriel affiché
  newOpts: { seed: string; profile: ProfileId; difficulty: Difficulty; mode: Mode };
};

let game: GameState | null = null;
const ui: UIState = {
  screen: 'home', filter: 'budget', search: '', pedago: false,
  open: new Set<string>(['dash']),
  tutorial: false,
  newOpts: { seed: randomSeed(), profile: 'reformateur', difficulty: 'normal', mode: 'complet' },
};

const TUTORIAL_KEY = 'p2027_tuto';
function tutorialSeen(): boolean { try { return localStorage.getItem(TUTORIAL_KEY) === '1'; } catch { return false; } }
function markTutorialSeen(): void { try { localStorage.setItem(TUTORIAL_KEY, '1'); } catch { /* */ } }

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
  const p = s.politics;
  const eventsPending = s.currentEvents.length > 0;

  return `<div class="tricolore"></div>
  <header class="topbar"><div class="topbar-row wrap">
    <span class="brand">Président 2027</span>
    <span class="date-pill">${esc(s.meta.dateLabel)}</span>
    <span class="phase-pill">${phaseLabel(s)}</span>
    <span class="topbar-spacer"></span>
    <span class="resources">
      <span class="res" title="Capital politique : sert à décider">💪 <b>${Math.round(p.capital)}</b></span>
      <span class="res" title="Points d'action restants ce tour">⏱️ <b>${p.actionPoints}/${p.maxActionPoints}</b></span>
      <span class="res" title="Popularité">📊 <b>${Math.round(p.popularity)}%</b></span>
    </span>
    <button class="btn ghost small" data-act="help" aria-label="Aide">❔</button>
    <button class="btn ghost small" data-act="toggle-theme" aria-label="Changer de thème">🌓</button>
    <button class="btn ghost small" data-act="menu">☰</button>
  </div></header>

  <div class="wrap"><div class="layout">
    <main>
      ${renderObjective(s)}
      ${eventsPending ? `<div class="events-flag">⚠️ Décision(s) requise(s) — traitez l'événement avant de terminer le trimestre.</div>${renderEvents(s)}` : ''}
      ${ui.pedago && s.explain.length ? renderPedago(s) : ''}
      ${renderActions(s)}
    </main>
    <aside>
      ${renderDashboard(s)}
      ${panel('detail', '📊 Plus d\'indicateurs', renderDetail(s))}
      ${panel('assemblee', `🏛️ Assemblée &amp; censure${risqueCensure(s) > 55 && !p.cohabitation ? ' <span class="badge-inline">risque</span>' : ''}`, renderAssembly(s))}
      ${panel('sondage', '📊 Sondage par catégorie', renderSondage(s))}
      ${panel('charts', '📉 Historique', renderCharts(s))}
      ${panel('conseillers', '🗣️ Conseillers', renderAdvisors(s))}
      ${panel('journal', '📓 Journal de mandat', renderJournal(s))}
    </aside>
  </div></div>

  <div class="actionbar"><div class="wrap">
    <label class="toggle"><input type="checkbox" data-act="toggle-pedago" ${ui.pedago ? 'checked' : ''}/> <span>Expliquer</span></label>
    <span class="info">${eventsPending ? '⚠️ Traitez l\'événement' : `💪 ${Math.round(p.capital)} · ⏱️ ${p.actionPoints}`}</span>
    <span class="topbar-spacer"></span>
    <button class="btn primary" data-act="end-turn" ${eventsPending ? 'disabled' : ''}>Terminer ${s.meta.phase === 'CAMPAGNE' ? 'le mois' : 'le trimestre'} ▶</button>
  </div></div>
  ${ui.tutorial ? renderTutorial() : ''}`;
}

function phaseLabel(s: GameState): string {
  if (s.meta.phase === 'CAMPAGNE') return 'Campagne 2027';
  if (s.meta.phase === 'ELECTION') return 'Élection';
  return s.politics.cohabitation ? `Mandat ${s.meta.mandat} · Cohabitation` : `Mandat ${s.meta.mandat}`;
}

/** Panneau repliable (l'état ouvert/fermé persiste dans ui.open). */
function panel(key: string, titleHtml: string, bodyHtml: string): string {
  const open = ui.open.has(key);
  return `<div class="card panel">
    <button class="panel-head" data-act="toggle-open" data-key="${key}" aria-expanded="${open}">
      <span>${titleHtml}</span><span class="chev">${open ? '▾' : '▸'}</span>
    </button>
    ${open ? `<div class="panel-body">${bodyHtml}</div>` : ''}
  </div>`;
}

// --------------------------------------------------------------------------
// Bandeau d'objectif : le « cap », avec le déficit projeté qui bouge en direct.
// --------------------------------------------------------------------------
function renderObjective(s: GameState): string {
  const p = s.politics;
  const campagne = s.meta.phase === 'CAMPAGNE' || s.meta.phase === 'ELECTION';
  if (campagne) {
    const pop = p.popularity;
    const prog = Math.max(0, Math.min(100, ((pop - 20) / 30) * 100));
    const col = pop >= 45 ? 'var(--ok)' : pop >= 35 ? 'var(--warn)' : 'var(--danger)';
    return `<div class="card objective">
      <div class="obj-goal">🗳️ Cap : <b>gagner la présidentielle de 2027</b></div>
      <div class="obj-metric">
        <div class="metric-big"><span class="metric-proj" style="color:${col}">${Math.round(pop)}%</span>
          <span class="metric-cap">de popularité — faites campagne et tenez la barre au-dessus de la moyenne</span></div>
        <div class="obj-bar"><span style="width:${prog}%;background:${col}"></span></div>
        <div class="obj-tally muted">Chaque meeting et bonne décision compte. Les promesses tenues pèsent au second tour.</div>
      </div></div>`;
  }
  const cur = s.macro.deficitPct;
  const proj = projectedDeficit(s);
  const tally = turnBudgetTally(s);
  // Barre : 8 % (vide) -> 3 % (pleine).
  const prog = Math.max(0, Math.min(100, ((8 - proj) / (8 - 3)) * 100));
  const projCol = proj < 3 ? 'var(--ok)' : proj < 5 ? 'var(--warn)' : 'var(--danger)';
  const tallyTxt = Math.abs(tally) < 0.5 ? 'aucune décision budgétaire ce trimestre'
    : `${tally > 0 ? '+' : ''}${tally.toFixed(0)} Md€ de décisions ce trimestre`;
  return `<div class="card objective">
    <div class="obj-goal">🎯 Cap : <b>ramener le déficit sous 3 % du PIB</b> ${s.meta.mandat >= 2 ? '· 2d mandat' : 'avant 2030'}</div>
    <div class="obj-metric">
      <div class="metric-big">
        <span class="metric-now">${fmt(cur)}%</span>
        <span class="arrow">→</span>
        <span class="metric-proj" style="color:${projCol}" title="Déficit projeté au prochain trimestre, mis à jour à chaque décision">${fmt(proj)}%</span>
        <span class="metric-cap">projeté · cible <b>3 %</b></span>
      </div>
      <div class="obj-bar"><span style="width:${prog}%;background:${projCol}"></span><i class="obj-target">3%</i></div>
      <div class="obj-tally"><b>${tallyTxt}</b> · Dette ${fmt(s.macro.debtPct, 0)} % · Popularité ${Math.round(p.popularity)} %</div>
    </div></div>`;
}

function renderDashboard(s: GameState): string {
  const m = s.macro, e = s.economy, p = s.politics;
  const g = (lbl: string, val: string, bar?: string) =>
    `<div class="gauge"><div class="lbl">${lbl}</div><div class="val">${val}</div>${bar ?? ''}</div>`;
  return `<div class="card"><h2>📈 L'essentiel</h2><div class="gauges">
    ${g('Déficit', `${fmt(m.deficitPct)}<small>% PIB</small>`, gaugeBar(100 - (m.deficitPct / 14) * 100))}
    ${g('Dette', `${fmt(m.debtPct, 0)}<small>% PIB</small>`, gaugeBar(100 - (m.debtPct - 90) * 1.6))}
    ${g('Croissance', `${fmt(e.growth)}<small>%</small>`, gaugeBar((e.growth + 2) * 20))}
    ${g('Chômage', `${fmt(e.unemployment)}<small>%</small>`, gaugeBar(100 - (e.unemployment - 3) * 8))}
    ${g('Popularité', `${fmt(p.popularity, 0)}`, gaugeBar(p.popularity))}
    ${g('Tension', `${fmt(p.socialTension, 0)}`, gaugeBar(p.socialTension, true))}
  </div></div>`;
}

function renderDetail(s: GameState): string {
  const m = s.macro, e = s.economy;
  const g = (lbl: string, val: string, bar?: string) =>
    `<div class="gauge"><div class="lbl">${lbl}</div><div class="val">${val}</div>${bar ?? ''}</div>`;
  return `<div class="gauges">
    ${g('Charge dette', `${fmt(m.interestCharge, 0)}<small>Md€/an</small>`)}
    ${g('Inflation', `${fmt(e.inflation)}<small>%</small>`, gaugeBar(100 - Math.abs(e.inflation - 2) * 20))}
    ${g('Spread', `${fmt(m.spread, 0)}<small>bps</small>`, gaugeBar(100 - m.spread / 4))}
    ${g('Pouvoir d\'achat', `${fmt(e.purchasingPower, 0)}`, gaugeBar(e.purchasingPower))}
    ${g('Notation S&P', ratingLabel(m.ratings.sp))}
    ${g('Réputation', `${fmt(s.intl.reputation, 0)}`, gaugeBar(s.intl.reputation))}
  </div>
  <p class="small muted" style="margin-top:8px">Poids en Europe ${fmt(s.intl.europeWeight, 0)} · Armée ${fmt(s.intl.armyStrength, 0)} · Munitions ${fmt(s.intl.ammoStock, 0)} · Confiance institutions ${fmt(s.politics.institutionalTrust, 0)}</p>`;
}

function renderCharts(s: GameState): string {
  const h = s.history;
  return `<div class="chart-grid">
    <div class="chart-box"><div class="t">Déficit (% PIB)</div>${lineChart(h, (x) => x.deficitPct, { color: '#c0261f', unit: '%', title: 'Déficit', invert: true })}</div>
    <div class="chart-box"><div class="t">Dette (% PIB)</div>${lineChart(h, (x) => x.debtPct, { color: '#8e44ad', unit: '%', title: 'Dette', invert: true })}</div>
    <div class="chart-box"><div class="t">Popularité</div>${lineChart(h, (x) => x.popularity, { color: '#2e5cff', unit: '', title: 'Popularité' })}</div>
    <div class="chart-box"><div class="t">Croissance (%)</div>${lineChart(h, (x) => x.growth, { color: '#1f8a4c', unit: '%', title: 'Croissance' })}</div>
  </div>`;
}

function renderAssembly(s: GameState): string {
  const maj = majoriteSoutien(s);
  const risk = risqueCensure(s);
  const rows = FAMILLES.map((f) => {
    const seats = s.politics.assembly.seats[f];
    const sup = s.politics.assembly.support[f];
    return `<div class="asm-row">
      <span class="fam-tag" style="background:${FAMILLE_COLOR[f]}">${FAMILLE_LABEL[f]}</span>
      <span class="small muted">${seats} sièges</span>
      <span class="small" style="margin-left:auto">soutien ${Math.round(sup)}%</span></div>`;
  }).join('');
  return `<p class="small">Soutien présidentiel : <b>${maj}</b> / ${MAJORITE_ABSOLUE} sièges requis.
    Risque de censure : <b style="color:${risk > 55 ? 'var(--danger)' : risk > 30 ? 'var(--warn)' : 'var(--ok)'}">${Math.round(risk)}%</b></p>
    ${rows}`;
}

function renderSondage(s: GameState): string {
  return GROUPS.map((gr) => {
    const v = s.politics.groups[gr];
    return `<div style="display:flex;align-items:center;gap:8px;margin:3px 0">
      <div style="width:120px;font-size:.8rem">${GROUP_LABEL[gr]}</div>
      <div class="bar" style="flex:1"><span style="width:${v}%;background:${barColor(v)}"></span></div>
      <div class="small" style="width:34px;text-align:right">${Math.round(v)}%</div></div>`;
  }).join('');
}

function renderAdvisors(s: GameState): string {
  const msgs = advisorMessages(s);
  return `<p class="small muted">Leurs avis divergent — et ne sont pas toujours justes.</p>
    ${msgs.map((mm) => `<div class="advisor"><div class="emoji">${mm.emoji}</div>
      <div><div class="who">${esc(mm.who)}</div><div class="say">« ${esc(mm.say)} »</div></div></div>`).join('')}`;
}

function renderJournal(s: GameState): string {
  const items = s.journal.slice(-40).reverse().map((j) =>
    `<li><span class="jt">${esc(j.label)}</span>${esc(j.texte)}</li>`).join('');
  return `<ul class="journal-list">${items}</ul>`;
}

function renderTutorial(): string {
  return `<div class="overlay" role="dialog" aria-modal="true" aria-label="Comment jouer">
    <div class="tuto card">
      <h2>Bienvenue à l'Élysée 🇫🇷</h2>
      <p class="muted small">Vous êtes Président. Voici la boucle du jeu, en 4 points :</p>
      <ol class="tuto-steps">
        <li><b>🎯 Votre cap</b> (en haut) : l'objectif et le <b>déficit projeté</b>. Ce chiffre bouge <b>dès que vous décidez</b> une mesure — visez sous 3 %.</li>
        <li><b>🎯 Agir</b> : dans « Leviers d'action », chaque mesure montre son <b>impact sur le déficit</b> (<span style="color:var(--ok)">vert = réduit</span>, <span style="color:var(--danger)">rouge = creuse</span>) et son coût (💪 capital, ⏱️ temps). Cliquez <b>Décider</b>. Le petit <b>⌄</b> déplie l'explication.</li>
        <li><b>⚠️ Événements</b> : quand un encadré orange apparaît, choisissez une option avant de continuer.</li>
        <li><b>▶ Terminer le trimestre</b> (bouton bleu, en bas) applique tout et fait avancer le temps.</li>
      </ol>
      <p class="small">⚖️ Attention à l'équilibre : sans majorité gare à la <b>censure</b>, une austérité trop brutale vous rend <b>impopulaire</b>… et l'<b>élection de 2027</b> arrive vite. Tout se joue sur les arbitrages.</p>
      <div class="row"><button class="btn primary" data-act="close-tutorial">C'est parti !</button></div>
    </div></div>`;
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
  const usedDomains = new Set(MEASURES.map((m) => m.domaine));
  const domTabs = DOMAINES_ORDRE.filter((d) => usedDomains.has(d))
    .map((d) => `<button class="tab ${ui.filter === d ? 'active' : ''}" data-filter="${d}">${DOMAINE_LABEL[d]}</button>`);
  const tabs = [
    `<button class="tab ${ui.filter === 'all' ? 'active' : ''}" data-filter="all">⭐ Toutes</button>`,
    ...domTabs,
    `<button class="tab ${ui.filter === 'pouvoirs' ? 'active' : ''}" data-filter="pouvoirs">⚡ Pouvoirs</button>`,
  ];

  let body = '';
  let count = 0;
  if (ui.filter === 'pouvoirs') {
    body = POWERS.map((pw) => renderPower(s, pw)).join('');
    count = POWERS.length;
  } else {
    const q = ui.search.trim().toLowerCase();
    const list = MEASURES.filter((mm) => {
      if (ui.filter !== 'all' && mm.domaine !== ui.filter) return false;
      if (q && !(`${mm.titre} ${mm.description}`.toLowerCase().includes(q))) return false;
      return true;
    });
    // Les mesures qui réduisent le déficit d'abord (comme un budget à bâtir).
    list.sort((a, b) => measureDeficitDelta(s, a) - measureDeficitDelta(s, b));
    count = list.length;
    body = list.length ? list.map((mm) => renderMeasure(s, mm)).join('')
      : '<p class="muted">Aucune mesure ne correspond.</p>';
  }

  return `<div class="card"><h2>🎛️ Leviers d'action <span class="muted small">(${count})</span></h2>
    <p class="hint small">💡 Choisissez des mesures : celles à impact <span style="color:var(--ok)">vert</span> réduisent le déficit, en <span style="color:var(--danger)">rouge</span> le creusent. Le « Cap » en haut se met à jour.</p>
    <div class="tabs">${tabs.join('')}</div>
    ${ui.filter !== 'pouvoirs' ? `<input class="search" type="search" placeholder="Rechercher une mesure…" value="${esc(ui.search)}" data-act="search" aria-label="Rechercher une mesure" />` : ''}
    ${body}
  </div>`;
}

function renderPower(s: GameState, pw: typeof POWERS[number]): string {
  const enough = s.politics.capital >= pw.coutCapital && s.politics.actionPoints >= pw.coutActionPoints;
  const open = ui.open.has('p:' + pw.id);
  return `<div class="measure ${enough ? '' : 'locked'}">
    <div class="m-row">
      <button class="m-toggle" data-act="toggle-open" data-key="p:${pw.id}" aria-label="Détails" aria-expanded="${open}">${open ? '▾' : '⌄'}</button>
      <div class="m-main"><div class="m-title">${pw.emoji} ${esc(pw.titre)}</div>
        <div class="m-chips">${pw.risque ? `<span class="chip warn">⚠️ ${esc(pw.risque)}</span>` : ''}</div></div>
      <div class="m-act"><span class="chip cost">${pw.coutCapital}💪 ${pw.coutActionPoints}⏱️</span>
        <button class="btn small primary" data-act="use-power" data-id="${pw.id}" ${enough ? '' : 'disabled'}>Utiliser</button></div>
    </div>
    ${open ? `<div class="m-body"><p class="desc">${esc(pw.description)}</p><p class="small src muted">ⓘ ${esc(pw.source_ou_ordre_de_grandeur)}</p></div>` : ''}
  </div>`;
}

function renderMeasure(s: GameState, mm: Measure): string {
  const av = measureAvailability(s, mm);
  const open = ui.open.has('m:' + mm.id);
  const delta = measureDeficitDelta(s, mm);
  const budgetLong = mm.effetsDiffered?.budgetMdEUR ?? 0;

  // Puce d'impact sur le déficit (le cœur du feedback « budget »).
  let deltaChip = '';
  if (Math.abs(delta) >= 0.01) {
    const good = delta < 0;
    deltaChip = `<span class="chip impact ${good ? 'good' : 'bad'}" title="Effet sur le déficit projeté">${good ? '▼' : '▲'} ${delta > 0 ? '+' : ''}${delta.toFixed(2)} pt déficit</span>`;
  } else if (budgetLong) {
    deltaChip = `<span class="chip">⏳ +${budgetLong} Md€ à terme</span>`;
  }
  const delai = mm.delaiTours ? `<span class="chip">⏳ ${mm.delaiTours} tr.</span>` : '';
  const oneshot = mm.oneShot ? '<span class="chip">unique</span>' : '';
  const risques = (mm.risques ?? []).map((r) => `<span class="chip warn">⚠️ ${esc(r)}</span>`).join('');

  return `<div class="measure ${av.ok ? '' : 'locked'}">
    <div class="m-row">
      <button class="m-toggle" data-act="toggle-open" data-key="m:${mm.id}" aria-label="Détails" aria-expanded="${open}">${open ? '▾' : '⌄'}</button>
      <div class="m-main">
        <div class="m-title">${esc(mm.titre)} <span class="fam-tag" style="background:${FAMILLE_COLOR[mm.famille]}">${FAMILLE_LABEL[mm.famille]}</span></div>
        <div class="m-chips">${deltaChip}${delai}${oneshot}</div>
      </div>
      <div class="m-act">
        <span class="chip cost">${mm.cout.capital}💪 ${mm.cout.actionPoints}⏱️</span>
        <button class="btn small primary" data-act="apply-measure" data-id="${mm.id}" ${av.ok ? '' : 'disabled'} title="${av.ok ? 'Appliquer cette mesure' : esc(av.raison ?? '')}">${av.ok ? 'Décider' : '🔒'}</button>
      </div>
    </div>
    ${open ? `<div class="m-body">
      <p class="desc">${esc(mm.description)}</p>
      <div class="meta">${risques}<span class="chip src">ⓘ ${esc(mm.source_ou_ordre_de_grandeur)}</span></div>
      ${!av.ok ? `<p class="small" style="color:var(--warn)">🔒 ${esc(av.raison ?? '')}</p>` : ''}
    </div>` : ''}
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
  ui.filter = 'budget';
  ui.open = new Set(['dash']);
  ui.tutorial = !tutorialSeen();
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
    case 'toggle-open': { const k = t.dataset.key!; if (ui.open.has(k)) ui.open.delete(k); else ui.open.add(k); return render(); }
    case 'close-tutorial': { ui.tutorial = false; markTutorialSeen(); return render(); }
    case 'help': { ui.tutorial = true; return render(); }
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
