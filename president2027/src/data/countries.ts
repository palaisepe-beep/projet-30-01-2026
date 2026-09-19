import type { PaysId } from '../engine/types.ts';

export type Pays = {
  id: PaysId;
  nom: string;
  drapeau: string;
  relationDepart: number;   // -100..+100
  dirigeant: string;        // personnage FICTIF
  note: string;
};

// Dirigeants étrangers FICTIFS. Aucune personne réelle n'est visée.
export const PAYS: Pays[] = [
  { id: 'usa', nom: 'États-Unis', drapeau: '🇺🇸', relationDepart: 45, dirigeant: 'Présidente Whitmore-Cole', note: 'Allié de l\'OTAN, mais protectionniste et imprévisible.' },
  { id: 'allemagne', nom: 'Allemagne', drapeau: '🇩🇪', relationDepart: 60, dirigeant: 'Chancelier Brandtmüller', note: 'Partenaire clé du couple franco-allemand, prudent sur la dette commune.' },
  { id: 'royaumeUni', nom: 'Royaume-Uni', drapeau: '🇬🇧', relationDepart: 40, dirigeant: 'Premier ministre Ashworth', note: 'Coopération de défense, rivalité commerciale post-Brexit.' },
  { id: 'italie', nom: 'Italie', drapeau: '🇮🇹', relationDepart: 35, dirigeant: 'Présidente du Conseil Rinaldi', note: 'Alliée possible sur la dette et la migration, ligne dure sur les frontières.' },
  { id: 'espagne', nom: 'Espagne', drapeau: '🇪🇸', relationDepart: 50, dirigeant: 'Président Vidal-Serrano', note: 'Proche sur le social et l\'énergie.' },
  { id: 'pologne', nom: 'Pologne', drapeau: '🇵🇱', relationDepart: 30, dirigeant: 'Premier ministre Kowalczyk', note: 'Faucon anti-russe, moteur de la défense de l\'Est.' },
  { id: 'russie', nom: 'Russie', drapeau: '🇷🇺', relationDepart: -60, dirigeant: 'Président Volkov', note: 'Adversaire stratégique, guerre en Ukraine.' },
  { id: 'chine', nom: 'Chine', drapeau: '🇨🇳', relationDepart: -10, dirigeant: 'Secrétaire général Li Zhenhua', note: 'Partenaire commercial et rival systémique.' },
  { id: 'ukraine', nom: 'Ukraine', drapeau: '🇺🇦', relationDepart: 65, dirigeant: 'Président Ostapenko', note: 'Pays soutenu, demandes d\'aide constantes.' },
  { id: 'inde', nom: 'Inde', drapeau: '🇮🇳', relationDepart: 25, dirigeant: 'Premier ministre Raghunathan', note: 'Puissance montante, non-alignée.' },
  { id: 'turquie', nom: 'Turquie', drapeau: '🇹🇷', relationDepart: -5, dirigeant: 'Président Demirören', note: 'Allié OTAN ambigu, acteur en Méditerranée et au Sahel.' },
  { id: 'maghreb', nom: 'Algérie & Maghreb', drapeau: '🌍', relationDepart: 5, dirigeant: 'Président Benhamou', note: 'Énergie, mémoire, migration : relation sensible.' },
  { id: 'sahel', nom: 'Sahel', drapeau: '🏜️', relationDepart: -15, dirigeant: 'Juntes régionales', note: 'Retrait français, influence russe/wagnérienne, terrorisme.' },
  { id: 'moyenOrient', nom: 'Moyen-Orient', drapeau: '🕌', relationDepart: 10, dirigeant: 'Coalition d\'États du Golfe', note: 'Énergie, contrats d\'armement, foyers de crise.' },
];

export function initialRelations(): Record<PaysId, number> {
  const r = {} as Record<PaysId, number>;
  for (const p of PAYS) r[p.id] = p.relationDepart;
  return r;
}

export function paysById(id: PaysId): Pays {
  return PAYS.find((p) => p.id === id)!;
}
