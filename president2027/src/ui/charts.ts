import type { Snapshot } from '../engine/index.ts';

type Accessor = (s: Snapshot) => number;

/**
 * Génère un graphique linéaire SVG (inline, thème-compatible) depuis l'historique.
 * Pas de dépendance : SVG pur, accessible via <title>.
 */
export function lineChart(history: Snapshot[], accessor: Accessor, opts: {
  color: string; unit?: string; title: string; invert?: boolean;
}): string {
  const W = 300, H = 90, pad = 6;
  if (history.length < 2) {
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.title} (pas assez de données)"><text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="var(--texte-doux)" font-size="11">—</text></svg>`;
  }
  const vals = history.map(accessor);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const range = max - min;
  const n = history.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / range) * (H - 2 * pad);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const areaPts = `${pad},${H - pad} ${pts} ${W - pad},${H - pad}`;
  const last = vals[n - 1];
  const first = vals[0];
  const up = last >= first;
  const good = opts.invert ? !up : up;
  const trendColor = good ? 'var(--ok)' : 'var(--danger)';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.title} : de ${first.toFixed(1)} à ${last.toFixed(1)} ${opts.unit ?? ''}">
    <polygon points="${areaPts}" fill="${opts.color}" opacity="0.12" />
    <polyline points="${pts}" fill="none" stroke="${opts.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3" fill="${trendColor}" />
    <text x="${W - pad}" y="12" text-anchor="end" font-size="11" font-weight="700" fill="${trendColor}">${last.toFixed(1)}${opts.unit ?? ''}</text>
  </svg>`;
}
