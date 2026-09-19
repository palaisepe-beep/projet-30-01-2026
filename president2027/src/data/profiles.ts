import type { ProfileId, Group, Famille, Effet } from '../engine/types.ts';

export type Profile = {
  id: ProfileId;
  nom: string;
  emoji: string;
  description: string;
  force: string;
  faiblesse: string;
  charisme: number;                 // ajout à la cible d'opinion de tous les groupes
  capitalRegenBonus: number;        // capital politique / tour
  groupBonus: Partial<Record<Group, number>>;      // approbation de départ
  familleAffinite: Partial<Record<Famille, number>>; // soutien parlementaire de départ
  startPatch?: Effet;               // ajustements de l'état initial
};

// 5 profils avec bonus ET malus. Aucun n'est objectivement meilleur.
export const PROFILES: Profile[] = [
  {
    id: 'technocrate',
    nom: 'La Technocrate',
    emoji: '📊',
    description:
      "Énarque rigoureuse, respectée à Bercy et à Bruxelles, mais perçue comme froide. " +
      'Les marchés et les partenaires européens vous font confiance ; le peuple vous trouve distante.',
    force: 'Crédibilité budgétaire (marchés + Bruxelles), meilleure gestion de la dette.',
    faiblesse: 'Charisme faible, popularité fragile chez les classes populaires.',
    charisme: -3,
    capitalRegenBonus: 2,
    groupBonus: { cadres: 8, patrons: 6, classesPopulaires: -6, banlieues: -4 },
    familleAffinite: { centre: 6, droite: 4 },
    startPatch: { macro: { spread: -12 }, intl: { europeWeight: 6 } },
  },
  {
    id: 'tribun',
    nom: 'Le Tribun populaire',
    emoji: '📣',
    description:
      'Orateur hors pair, adoré dans les meetings, redouté des éditorialistes. ' +
      'Vous mobilisez les foules mais inquiétez les investisseurs.',
    force: 'Charisme élevé, capital politique qui se recharge vite, popularité résiliente.',
    faiblesse: 'Marchés nerveux (spread plus élevé), relations européennes plus tièdes.',
    charisme: 6,
    capitalRegenBonus: 5,
    groupBonus: { classesPopulaires: 8, jeunes: 5, patrons: -5, cadres: -3 },
    familleAffinite: { gaucheSociale: 5, gaucheRadicale: 4 },
    startPatch: { macro: { spread: 20 }, politics: { capital: 6 } },
  },
  {
    id: 'reformateur',
    nom: 'Le Réformateur',
    emoji: '⚙️',
    description:
      "Vous voulez transformer le pays en profondeur : État, retraites, marché du travail. " +
      "Les effets se voient à long terme, mais la rue gronde d'emblée.",
    force: 'Réformes structurelles plus efficaces (effets différés amplifiés), confiance des entreprises.',
    faiblesse: 'Tension sociale de départ élevée, fonctionnaires et classes populaires méfiants.',
    charisme: 1,
    capitalRegenBonus: 3,
    groupBonus: { patrons: 6, cadres: 4, fonctionnaires: -8 },
    familleAffinite: { centre: 4, droite: 6 },
    startPatch: { economy: { businessConfidence: 6 }, politics: { socialTension: 10 } },
  },
  {
    id: 'souverainiste',
    nom: 'La Souverainiste',
    emoji: '🛡️',
    description:
      "Ligne ferme sur la nation, les frontières et l'indépendance stratégique. " +
      "Populaire dans la ruralité, en froid avec Bruxelles et certains partenaires.",
    force: 'Soutien fort en ruralité et sur la sécurité, dissuasion et armée valorisées.',
    faiblesse: 'Poids en Europe réduit, relations avec l\'Allemagne et la Commission tendues.',
    charisme: 3,
    capitalRegenBonus: 3,
    groupBonus: { ruralite: 8, agriculteurs: 6, cadres: -3 },
    familleAffinite: { droite: 6, droiteNationale: 5, centre: -4 },
    startPatch: {
      intl: { deterrence: 5, armyMorale: 4, europeWeight: -8 },
      relations: { allemagne: -10 }, society: { securite: 4 },
    },
  },
  {
    id: 'ecologiste',
    nom: "L'Écologiste",
    emoji: '🌿',
    description:
      'Vous placez la transition et le climat au cœur du mandat. La jeunesse vous suit, ' +
      "l'industrie et les agriculteurs s'inquiètent du coût et du rythme.",
    force: 'Bond écologique, popularité chez les jeunes, image internationale verte.',
    faiblesse: 'Croissance et compétitivité de départ plus faibles, agriculteurs remontés.',
    charisme: 2,
    capitalRegenBonus: 2,
    groupBonus: { jeunes: 9, agriculteurs: -8, patrons: -4 },
    familleAffinite: { ecologistes: 8, gaucheSociale: 4, droite: -3 },
    startPatch: {
      society: { ecologie: 10 }, economy: { competitiveness: -4, growth: -0.2 },
      intl: { reputation: 4 },
    },
  },
];

export function getProfile(id: ProfileId): Profile {
  return PROFILES.find((p) => p.id === id) ?? PROFILES[0];
}
