import type { Group, Famille, Domaine } from '../engine/index.ts';

export const GROUP_LABEL: Record<Group, string> = {
  jeunes: 'Jeunes', retraites: 'Retraités', classesMoyennes: 'Classes moyennes',
  classesPopulaires: 'Classes populaires', cadres: 'Cadres', agriculteurs: 'Agriculteurs',
  fonctionnaires: 'Fonctionnaires', patrons: 'Patrons', banlieues: 'Banlieues', ruralite: 'Ruralité',
};

export const FAMILLE_LABEL: Record<Famille, string> = {
  gaucheRadicale: 'Gauche radicale', gaucheSociale: 'Gauche sociale', ecologistes: 'Écologistes',
  centre: 'Centre', droite: 'Droite', droiteNationale: 'Droite nationale',
};

export const FAMILLE_COLOR: Record<Famille, string> = {
  gaucheRadicale: '#c0392b', gaucheSociale: '#e8748c', ecologistes: '#27ae60',
  centre: '#f39c12', droite: '#2e5cff', droiteNationale: '#1a2a44',
};

export const DOMAINE_LABEL: Record<Domaine, string> = {
  budget: 'Budget', fiscalite: 'Fiscalité', social: 'Social', dette: 'Dette', interieur: 'Intérieur',
  institutions: 'Institutions', europe: 'Europe', diplomatie: 'Diplomatie', defense: 'Défense',
  energie: 'Énergie', ecologie: 'Écologie', education: 'Éducation', sante: 'Santé', securite: 'Sécurité',
  justice: 'Justice', immigration: 'Immigration', economie: 'Économie', communication: 'Communication',
};

export const SOCIETY_LABEL: Record<string, string> = {
  sante: 'Santé', education: 'Éducation', securite: 'Sécurité', justice: 'Justice', ecologie: 'Écologie',
  energie: 'Énergie', demographie: 'Démographie', immigrationPressure: 'Pression migratoire',
  logement: 'Logement', cohesion: 'Cohésion',
};

/** Échappe le HTML pour insérer du texte utilisateur/données en toute sécurité. */
export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
