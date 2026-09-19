import type { GameState, Explain } from './types.ts';
import { START, clamp, round1 } from './constants.ts';
import { clampState } from './effects.ts';

const FISCAL_MULTIPLIER = 0.35;  // 1 pt de consolidation => ~0.35 pt de croissance en moins
const STRUCT_UNEMP = 7.0;        // taux de chômage structurel de référence
const GROWTH_SMOOTH = 0.5;       // inertie de la croissance
const OKUN = 0.30;               // sensibilité chômage/croissance
const ROLLOVER = 1 / 40;         // part du stock refinancée par trimestre (maturité longue)

/**
 * Mise à jour macro-économique d'un trimestre. Mute l'état, renvoie les
 * explications pédagogiques.
 */
export function updateEconomy(state: GameState, difficultyNervous: number): Explain[] {
  const m = state.macro;
  const e = state.economy;
  const ex: Explain[] = [];

  // --- Impulsion budgétaire (consolidation vs relance) ---------------------
  const impulse = m.primaryBalancePct - state.scratch.prevPrimary; // >0 = consolidation
  state.scratch.prevPrimary = m.primaryBalancePct;

  // --- Croissance ----------------------------------------------------------
  const growthPrev = e.growth;
  const growthTarget =
    START.trendGrowth
    + 0.08 * (e.businessConfidence - 50) / 10
    + 0.06 * (e.investment - 50) / 10
    + 0.05 * (e.competitiveness - 50) / 10
    - FISCAL_MULTIPLIER * impulse
    + state.scratch.growthShock
    - 0.02 * (state.politics.socialTension - 40) / 10;
  e.growth = growthPrev + (growthTarget - growthPrev) * GROWTH_SMOOTH;
  e.growth = clamp(e.growth, -6, 6);

  // --- Chômage (Okun) ------------------------------------------------------
  const unempPrev = e.unemployment;
  e.unemployment += -OKUN * (e.growth - START.potentialGrowth)
    + 0.07 * (STRUCT_UNEMP - e.unemployment); // réversion vers le chômage structurel
  e.unemployment = clamp(e.unemployment, 2.5, 16);

  // --- Inflation -----------------------------------------------------------
  const inflPrev = e.inflation;
  const rateGap = m.marketRate - 2.0;
  e.inflation += 0.15 * state.scratch.energyShock
    + 0.10 * (e.growth - START.potentialGrowth)
    - 0.10 * rateGap
    - 0.15 * (e.inflation - 2.0); // rappel vers la cible BCE
  e.inflation = clamp(e.inflation, -1, 12);

  // --- Pouvoir d'achat -----------------------------------------------------
  // Salaires réels ~ croissance - inflation ; effet sur l'indice.
  e.purchasingPower += 0.6 * (e.growth - 0.5) - 0.7 * (e.inflation - 2.0);
  e.purchasingPower = clamp(e.purchasingPower, 0, 100);

  // --- Taux, spread, charge de la dette ------------------------------------
  const spreadPrev = m.spread;
  const debtPressure = 4 * (m.debtPct - 115) / 10;
  const deficitPressure = 3 * Math.max(0, m.deficitPct - 3);
  const politicalRisk =
    0.15 * (state.politics.socialTension - 40)
    + (state.meta.flags.includes('monetisation') ? 40 : 0)
    + (state.politics.censureCount > 0 ? 15 * state.politics.censureCount : 0)
    - 0.10 * (state.intl.reputation - 55);
  const ratingPenalty = (54 - (m.ratings.sp + m.ratings.moody + m.ratings.fitch)) * 6;
  const targetSpread = clamp(
    (debtPressure + deficitPressure + politicalRisk + ratingPenalty) * difficultyNervous,
    -20, 700);
  m.spread += (targetSpread - m.spread) * 0.35;
  m.spread = clamp(m.spread, -20, 700);

  m.marketRate = clamp(START.baseBund + m.spread / 100, 0, 12);
  m.apparentRate += (m.marketRate - m.apparentRate) * ROLLOVER;
  m.apparentRate = clamp(m.apparentRate, 0, 10);
  m.interestCharge = (m.apparentRate / 100) * m.debt;

  // --- Déficit et dette ----------------------------------------------------
  const cyclicalRevenue = 0.5 * (e.growth - START.potentialGrowth);
  const interestPct = (m.interestCharge / m.pib) * 100;
  m.deficitPct = clamp(-m.primaryBalancePct + interestPct - cyclicalRevenue, -4, 14);

  // Dette : flux trimestriel + effet des taux déjà intégré via le déficit.
  const quarterDeficit = (m.deficitPct / 100) * m.pib / 4;
  m.debt += quarterDeficit;
  m.debt = Math.max(0, m.debt);

  // PIB nominal (croissance réelle + inflation).
  m.pib *= 1 + (e.growth / 100) / 4 + (e.inflation / 100) / 4;
  m.debtPct = (m.debt / m.pib) * 100;

  // --- Confiance des entreprises / investissement (dérive douce) -----------
  e.businessConfidence += 0.3 * (e.growth - 0.8) - 0.2 * Math.max(0, m.marketRate - 3)
    - 0.1 * (state.politics.socialTension - 40) / 5;
  e.investment += 0.2 * (e.businessConfidence - 50) / 10 - 0.1 * (m.marketRate - 3);
  e.tradeBalance += 0.05 * (e.competitiveness - 50) / 10;

  // --- Notations (hystérésis) ---------------------------------------------
  updateRatings(state, ex);

  clampState(state);

  // --- Explications --------------------------------------------------------
  ex.push({ label: 'Croissance', delta: round1(e.growth - growthPrev), raison:
    impulse > 0.05 ? 'La consolidation budgétaire pèse sur l\'activité.'
    : impulse < -0.05 ? 'La relance budgétaire soutient l\'activité.'
    : 'Dérive tendancielle et confiance.' });
  ex.push({ label: 'Chômage', delta: round1(e.unemployment - unempPrev), raison:
    e.growth > START.potentialGrowth ? 'La croissance crée des emplois.' : 'Croissance sous le potentiel.' });
  ex.push({ label: 'Inflation', delta: round1(e.inflation - inflPrev), raison:
    state.scratch.energyShock > 0 ? 'Choc énergétique.' : 'Retour progressif vers la cible.' });
  ex.push({ label: 'Spread OAT/Bund', delta: Math.round(m.spread - spreadPrev), raison:
    m.spread > spreadPrev ? 'Les marchés se tendent (dette, déficit ou instabilité).'
    : 'Détente sur les marchés obligataires.' });
  ex.push({ label: 'Charge de la dette', delta: round1(interestPct), raison:
    `${Math.round(m.interestCharge)} Md€/an à taux apparent ${round1(m.apparentRate)} %.` });

  // Reset des chocs transitoires.
  state.scratch.growthShock = 0;
  state.scratch.energyShock *= 0.4; // un choc énergétique persiste un peu

  return ex;
}

/**
 * Notations souveraines avec hystérésis : le score de crédit doit rester
 * au-delà d'un seuil deux tours de suite pour changer d'un cran.
 */
function updateRatings(state: GameState, ex: Explain[]): void {
  const m = state.macro;
  const stability = 100 - state.politics.socialTension
    + (state.politics.cohabitation ? -8 : 0)
    - state.politics.censureCount * 10;
  const creditScore =
    22
    - Math.max(0, (m.debtPct - 100) / 5)      // dette
    - Math.max(0, (m.deficitPct - 3)) * 1.2   // déficit
    + (state.economy.growth - 1) * 0.8         // croissance
    + (stability - 60) / 40
    - Math.max(0, (m.spread - 80) / 120);
  const target = clamp(Math.round(creditScore), 4, 21);

  for (const agency of ['sp', 'moody', 'fitch'] as const) {
    const cur = m.ratings[agency];
    if (target < cur) {
      m.ratingTrend[agency] -= 1;
      if (m.ratingTrend[agency] <= -2) {
        m.ratings[agency] = cur - 1;
        m.ratingTrend[agency] = 0;
        state.macro.spread += 25; // une dégradation renchérit tout de suite
        ex.push({ label: `Notation ${agency.toUpperCase()}`, delta: -1, raison: 'Dégradation d\'un cran.' });
        state.depeches.push(`📉 ${agency.toUpperCase()} dégrade la note souveraine de la France.`);
      }
    } else if (target > cur) {
      m.ratingTrend[agency] += 1;
      if (m.ratingTrend[agency] >= 3) {
        m.ratings[agency] = cur + 1;
        m.ratingTrend[agency] = 0;
        ex.push({ label: `Notation ${agency.toUpperCase()}`, delta: 1, raison: 'Relèvement d\'un cran.' });
        state.depeches.push(`📈 ${agency.toUpperCase()} relève la note souveraine de la France.`);
      }
    } else {
      m.ratingTrend[agency] = 0;
    }
  }
}
