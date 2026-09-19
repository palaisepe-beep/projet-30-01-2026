import type { Famille, ProfileId, Domaine } from '../engine/types.ts';

// TOUS les personnages sont FICTIFS. Les partis sont fictifs mais reconnaissables
// par leur famille politique. Aucune personne réelle n'est visée ni caricaturée.

export type Parti = {
  famille: Famille;
  nom: string;
  sigle: string;
  couleur: string;
  chef: string;         // personnage fictif
  ligne: string;
};

export const PARTIS: Parti[] = [
  { famille: 'gaucheRadicale', nom: 'Union Populaire et Sociale', sigle: 'UPS', couleur: '#c0392b', chef: 'Amandine Roussel', ligne: 'Rupture, partage des richesses, planification écologique.' },
  { famille: 'gaucheSociale', nom: 'Parti Social-Démocrate', sigle: 'PSD', couleur: '#e8748c', chef: 'Karim Belkacem', ligne: 'Justice sociale, services publics, Europe sociale.' },
  { famille: 'ecologistes', nom: 'Les Écologistes Réunis', sigle: 'ÉR', couleur: '#27ae60', chef: 'Léa Nguyen', ligne: 'Transition, climat, qualité de vie.' },
  { famille: 'centre', nom: 'Alliance du Centre', sigle: 'AC', couleur: '#f39c12', chef: 'Le Président (vous)', ligne: 'Réforme, responsabilité, Europe.' },
  { famille: 'droite', nom: 'Rassemblement Républicain', sigle: 'RR', couleur: '#2e5cff', chef: 'Étienne de Villaret', ligne: 'Ordre, travail, baisse des impôts.' },
  { famille: 'droiteNationale', nom: 'Front des Patriotes', sigle: 'FP', couleur: '#1a2a44', chef: 'Sabine Marchand', ligne: 'Nation, frontières, préférence nationale.' },
];

export function partiOf(famille: Famille): Parti {
  return PARTIS.find((p) => p.famille === famille)!;
}

// --- Candidats à la présidentielle 2027 (fictifs) --------------------------
export type Candidat = {
  id: string;
  nom: string;
  famille: Famille;
  econLeftRight: number;  // -1 (gauche) .. +1 (droite)
  socialLibAuth: number;  // -1 (libéral) .. +1 (autoritaire)
  proEU: number;          // -1 (eurosceptique) .. +1 (pro-UE)
  baseFloor: number;      // socle électoral (part indicative)
  quality: number;        // 0.8 .. 1.2
};

export const CANDIDATS: Candidat[] = [
  { id: 'roussel', nom: 'Amandine Roussel', famille: 'gaucheRadicale', econLeftRight: -0.9, socialLibAuth: -0.3, proEU: -0.2, baseFloor: 0.14, quality: 1.05 },
  { id: 'belkacem', nom: 'Karim Belkacem', famille: 'gaucheSociale', econLeftRight: -0.5, socialLibAuth: -0.2, proEU: 0.5, baseFloor: 0.11, quality: 0.98 },
  { id: 'nguyen', nom: 'Léa Nguyen', famille: 'ecologistes', econLeftRight: -0.35, socialLibAuth: -0.4, proEU: 0.4, baseFloor: 0.08, quality: 0.95 },
  { id: 'villaret', nom: 'Étienne de Villaret', famille: 'droite', econLeftRight: 0.6, socialLibAuth: 0.4, proEU: 0.2, baseFloor: 0.13, quality: 1.0 },
  { id: 'marchand', nom: 'Sabine Marchand', famille: 'droiteNationale', econLeftRight: 0.3, socialLibAuth: 0.85, proEU: -0.8, baseFloor: 0.26, quality: 1.08 },
];

// Positionnement électoral du Président selon son profil.
export const PROFILE_POSITION: Record<ProfileId, { fam: Famille; econ: number; social: number; eu: number }> = {
  technocrate:  { fam: 'centre', econ: 0.15, social: 0.05, eu: 0.7 },
  tribun:       { fam: 'gaucheSociale', econ: -0.4, social: -0.1, eu: 0.1 },
  reformateur:  { fam: 'centre', econ: 0.35, social: 0.15, eu: 0.5 },
  souverainiste:{ fam: 'droite', econ: 0.25, social: 0.5, eu: -0.6 },
  ecologiste:   { fam: 'ecologistes', econ: -0.35, social: -0.25, eu: 0.4 },
};

// --- Premiers ministres possibles (fictifs), par famille -------------------
export const PM_NOMS: Record<Famille, string[]> = {
  gaucheRadicale: ['Nadia Faure', 'Thomas Lemaire'],
  gaucheSociale: ['Karim Belkacem', 'Hélène Dubreuil'],
  ecologistes: ['Léa Nguyen', 'Paul Vasseur'],
  centre: ['Claire Fontaine', 'Antoine Reverdy', 'Sophie Aumont'],
  droite: ['Étienne de Villaret', 'Marc Aubert'],
  droiteNationale: ['Sabine Marchand', 'Bruno Terrasse'],
};

// --- Conseillers (avec un biais : parfois contradictoires, parfois faux) ---
export type Conseiller = {
  id: string; nom: string; poste: string; emoji: string;
  domaines: Domaine[];   // domaines qu'il commente
  biais: string;         // penchant systématique
};

export const CONSEILLERS: Conseiller[] = [
  { id: 'finances', nom: 'M. Delaporte', poste: 'Conseiller finances (Bercy)', emoji: '💰', domaines: ['budget', 'fiscalite', 'dette', 'economie'], biais: 'Toujours pour la rigueur, minimise le coût social.' },
  { id: 'matignon', nom: 'Mme Aumont', poste: 'Cheffe de cabinet (Matignon)', emoji: '🏛️', domaines: ['interieur', 'social', 'institutions'], biais: 'Cherche la paix sociale, redoute la rue.' },
  { id: 'diplo', nom: 'M. Vasseur', poste: 'Conseiller diplomatique', emoji: '🌐', domaines: ['diplomatie', 'europe'], biais: 'Europhile, prudent, aime les compromis.' },
  { id: 'armees', nom: 'Général Ferrand', poste: 'Chef d\'état-major particulier', emoji: '🎖️', domaines: ['defense'], biais: 'Va-t-en-guerre mesuré, veut du budget.' },
  { id: 'com', nom: 'Mme Ohayon', poste: 'Conseillère communication', emoji: '📺', domaines: ['communication'], biais: 'Pense sondages avant tout, court terme.' },
  { id: 'sondages', nom: 'M. Petit', poste: 'Directeur des études d\'opinion', emoji: '📊', domaines: ['communication'], biais: 'Chiffres parfois erronés, marges d\'erreur ignorées.' },
];
