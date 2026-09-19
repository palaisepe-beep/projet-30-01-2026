import type { GameState } from '../engine/types.ts';

export type Achievement = {
  id: string;
  nom: string;
  emoji: string;
  description: string;
  condition: (s: GameState) => boolean;
};

// Succès amusants et pédagogiques.
export const ACHIEVEMENTS: Achievement[] = [
  { id: 'whatever', nom: 'Le « Whatever it takes »', emoji: '💶',
    description: 'Ramener le spread sous 30 points de base.',
    condition: (s) => s.macro.spread < 30 },
  { id: 'maastricht', nom: 'Élève de Maastricht', emoji: '📏',
    description: 'Déficit sous 3 % du PIB.',
    condition: (s) => s.macro.deficitPct < 3 },
  { id: 'desendettement', nom: 'Le Désendetteur', emoji: '📉',
    description: 'Dette sous 112 % du PIB.',
    condition: (s) => s.macro.debtPct < 112 },
  { id: 'horsdeprix', nom: 'Hors de prix', emoji: '💸',
    description: 'Laisser filer la dette au-dessus de 135 % du PIB.',
    condition: (s) => s.macro.debtPct > 135 },
  { id: 'pasdevague', nom: 'Pas de vague', emoji: '🌊',
    description: 'Finir un tour avec une tension sociale sous 20.',
    condition: (s) => s.politics.socialTension < 20 },
  { id: 'cohab', nom: 'Cohabitation forcée', emoji: '🏛️',
    description: 'Subir une cohabitation.',
    condition: (s) => s.politics.cohabitation },
  { id: 'reelu', nom: 'Deuxième service', emoji: '🎉',
    description: 'Être réélu(e) en 2027.',
    condition: (s) => s.meta.mandat >= 2 },
  { id: 'pleinemploi', nom: 'Plein-emploi', emoji: '💼',
    description: 'Chômage sous 5 %.',
    condition: (s) => s.economy.unemployment < 5 },
  { id: 'transition', nom: 'La Planète d\'abord', emoji: '🌍',
    description: 'Indice écologie au-dessus de 75.',
    condition: (s) => s.society.ecologie > 75 },
  { id: 'chef', nom: 'Chef de guerre', emoji: '🎖️',
    description: 'Mener un engagement militaire et garder un moral d\'armée > 70.',
    condition: (s) => s.intl.atWar.length > 0 && s.intl.armyMorale > 70 },
  { id: 'populaire', nom: 'Idole des foules', emoji: '📣',
    description: 'Popularité au-dessus de 65.',
    condition: (s) => s.politics.popularity > 65 },
  { id: 'europe', nom: 'Cœur de l\'Europe', emoji: '🇪🇺',
    description: 'Poids en Europe au-dessus de 80.',
    condition: (s) => s.intl.europeWeight > 80 },
  { id: 'survivant', nom: 'Le Survivant', emoji: '🪖',
    description: 'Survivre à une motion de censure et rester en fonction.',
    condition: (s) => s.politics.censureCount >= 1 && s.meta.phase !== 'FIN' },
  { id: 'jupiter', nom: 'Jupitérien', emoji: '⚡',
    description: 'Utiliser les pouvoirs exceptionnels (art. 16).',
    condition: (s) => s.meta.flags.includes('art16') },
];

/** Débloque les succès dont la condition est vraie. */
export function checkAchievements(state: GameState): string[] {
  const nouveaux: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.meta.achievements.includes(a.id) && a.condition(state)) {
      state.meta.achievements.push(a.id);
      nouveaux.push(a.id);
    }
  }
  return nouveaux;
}

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}
