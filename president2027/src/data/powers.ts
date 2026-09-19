import type { Condition } from '../engine/types.ts';

// Pouvoirs constitutionnels du Président. Traités à part des mesures car
// certains déclenchent une logique dédiée dans le moteur (dissolution,
// référendum, art. 16). Contraintes réelles simplifiées.

export type Power = {
  id: string;
  titre: string;
  emoji: string;
  description: string;
  coutCapital: number;
  coutActionPoints: number;
  conditions?: Condition;
  risque?: string;
  source_ou_ordre_de_grandeur: string;
};

export const POWERS: Power[] = [
  {
    id: 'pouv_remaniement', titre: 'Remaniement ministériel', emoji: '🔁',
    description: 'Renouveler l\'équipe gouvernementale pour relancer la dynamique et remotiver les troupes.',
    coutCapital: 8, coutActionPoints: 1,
    source_ou_ordre_de_grandeur: 'Effet d\'image + moral du gouvernement.',
  },
  {
    id: 'pouv_pm_ouverture', titre: 'Nommer un Premier ministre d\'ouverture', emoji: '🤝',
    description: 'Choisir un PM issu d\'une autre famille pour élargir la base parlementaire et calmer le jeu.',
    coutCapital: 12, coutActionPoints: 2,
    source_ou_ordre_de_grandeur: 'Élargissement de la majorité au prix de concessions.',
  },
  {
    id: 'pouv_49_3', titre: 'Recourir au 49.3', emoji: '⚡',
    description: 'Faire adopter un texte sans vote. Efficace mais arme la censure et enflamme la rue.',
    coutCapital: 6, coutActionPoints: 1,
    conditions: { flag: 'cohabitation', present: false } as any,
    risque: 'Motion de censure', source_ou_ordre_de_grandeur: 'Passage en force ; usure démocratique.',
  },
  {
    id: 'pouv_dissolution', titre: 'Dissoudre l\'Assemblée (art. 12)', emoji: '🗳️',
    description: 'Provoquer des législatives anticipées. Peut offrir une majorité... ou une cohabitation.',
    coutCapital: 18, coutActionPoints: 2,
    conditions: { path: 'politics.dissolutionCooldown', op: '<=', value: 0 },
    risque: 'Cohabitation', source_ou_ordre_de_grandeur: 'Pari politique majeur (précédent 2024).',
  },
  {
    id: 'pouv_referendum', titre: 'Convoquer un référendum (art. 11)', emoji: '🙋',
    description: 'Soumettre une réforme au peuple. Gain de légitimité si victoire, choc si défaite.',
    coutCapital: 15, coutActionPoints: 2,
    risque: 'Désaveu populaire', source_ou_ordre_de_grandeur: 'Plébiscite risqué (précédent 1969).',
  },
  {
    id: 'pouv_art16', titre: 'Activer les pouvoirs exceptionnels (art. 16)', emoji: '🚨',
    description: 'Concentrer les pouvoirs en cas de crise majeure. Risque institutionnel énorme.',
    coutCapital: 25, coutActionPoints: 3,
    conditions: { any: [{ path: 'politics.socialTension', op: '>', value: 80 }, { path: 'intl.armyMorale', op: '<', value: 30 }] },
    risque: 'Effondrement de la confiance institutionnelle', source_ou_ordre_de_grandeur: 'Usage exceptionnel (1961 comme unique précédent).',
  },
  {
    id: 'pouv_grace', titre: 'Grâce présidentielle', emoji: '⚖️',
    description: 'User du droit de grâce individuelle. Geste symbolique, effet d\'image limité.',
    coutCapital: 3, coutActionPoints: 1,
    source_ou_ordre_de_grandeur: 'Prérogative individuelle.',
  },
  {
    id: 'pouv_message', titre: 'Message solennel au Parlement (Congrès)', emoji: '🏛️',
    description: 'S\'adresser au Parlement réuni en Congrès pour fixer le cap. Effet d\'autorité.',
    coutCapital: 5, coutActionPoints: 1,
    source_ou_ordre_de_grandeur: 'Prise de parole solennelle.',
  },
];

export function powerById(id: string): Power | undefined {
  return POWERS.find((p) => p.id === id);
}
