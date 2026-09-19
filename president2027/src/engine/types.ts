// Types du moteur. Aucune dépendance UI. Tout l'état d'une partie est
// sérialisable en JSON (sauvegarde localStorage / export / import).

// ---------------------------------------------------------------------------
// Énumérations (unions de chaînes — compatibles avec le type-stripping Node).
// ---------------------------------------------------------------------------

/** Groupes sociologiques suivis par les sondages. */
export type Group =
  | 'jeunes'
  | 'retraites'
  | 'classesMoyennes'
  | 'classesPopulaires'
  | 'cadres'
  | 'agriculteurs'
  | 'fonctionnaires'
  | 'patrons'
  | 'banlieues'
  | 'ruralite';

export const GROUPS: Group[] = [
  'jeunes', 'retraites', 'classesMoyennes', 'classesPopulaires', 'cadres',
  'agriculteurs', 'fonctionnaires', 'patrons', 'banlieues', 'ruralite',
];

/** Familles politiques (fictives mais reconnaissables). */
export type Famille =
  | 'gaucheRadicale'
  | 'gaucheSociale'
  | 'ecologistes'
  | 'centre'
  | 'droite'
  | 'droiteNationale';

export const FAMILLES: Famille[] = [
  'gaucheRadicale', 'gaucheSociale', 'ecologistes', 'centre', 'droite', 'droiteNationale',
];

/** Domaines d'action. */
export type Domaine =
  | 'budget'
  | 'fiscalite'
  | 'social'
  | 'dette'
  | 'interieur'
  | 'institutions'
  | 'europe'
  | 'diplomatie'
  | 'defense'
  | 'energie'
  | 'ecologie'
  | 'education'
  | 'sante'
  | 'securite'
  | 'justice'
  | 'immigration'
  | 'economie'
  | 'communication';

export type Categorie =
  | 'economique'
  | 'social'
  | 'politique'
  | 'international'
  | 'naturel'
  | 'technologique'
  | 'positif';

export type Phase = 'MANDAT' | 'CAMPAGNE' | 'ELECTION' | 'FIN';
export type Mode = 'complet' | 'campagne' | 'bacASable';
export type Difficulty = 'facile' | 'normal' | 'realiste' | 'impitoyable';

export type ProfileId =
  | 'technocrate'
  | 'tribun'
  | 'reformateur'
  | 'souverainiste'
  | 'ecologiste';

export type PaysId =
  | 'usa' | 'allemagne' | 'royaumeUni' | 'italie' | 'espagne' | 'pologne'
  | 'russie' | 'chine' | 'ukraine' | 'inde' | 'turquie' | 'maghreb'
  | 'sahel' | 'moyenOrient';

// ---------------------------------------------------------------------------
// État de jeu
// ---------------------------------------------------------------------------

export type Macro = {
  pib: number;                // Md€ nominal
  deficitPct: number;         // % du PIB (déficit > 0)
  debt: number;               // Md€
  debtPct: number;            // % du PIB (calculé)
  primaryBalancePct: number;  // % PIB, solde primaire (hors intérêts)
  marketRate: number;         // % OAT 10 ans
  apparentRate: number;       // % taux moyen du stock de dette
  interestCharge: number;     // Md€/an (calculé)
  spread: number;             // points de base vs Bund
  mandatoryLevies: number;    // % PIB (prélèvements obligatoires)
  ratings: Record<'sp' | 'moody' | 'fitch', number>; // indice 0-21
  ratingTrend: Record<'sp' | 'moody' | 'fitch', number>; // compteur d'hystérésis
};

export type Economy = {
  growth: number;            // % annuel réel
  unemployment: number;      // %
  inflation: number;         // %
  purchasingPower: number;   // indice 0-100
  competitiveness: number;   // indice 0-100
  investment: number;        // indice 0-100
  tradeBalance: number;      // % PIB
  inequality: number;        // indice 0-100 (100 = très inégal)
  businessConfidence: number;// indice 0-100
};

export type Assembly = {
  seats: Record<Famille, number>;    // sièges par famille (total 577)
  support: Record<Famille, number>;  // soutien au Président 0-100
};

export type Politics = {
  popularity: number;                    // 0-100 (calculé)
  groups: Record<Group, number>;         // approbation par groupe 0-100
  capital: number;                       // capital politique 0-100
  actionPoints: number;                  // points d'action du tour
  maxActionPoints: number;
  assembly: Assembly;
  pmRelation: number;                    // 0-100
  pmFamily: Famille;                     // famille du Premier ministre
  ministerMorale: number;                // 0-100
  socialTension: number;                 // 0-100
  institutionalTrust: number;            // 0-100
  cohabitation: boolean;
  censureCount: number;                  // motions de censure adoptées ce mandat
  dissolutionCooldown: number;           // tours avant nouvelle dissolution possible
  lastReferendumTurn: number;
};

export type Society = {
  sante: number; education: number; securite: number; justice: number;
  ecologie: number; energie: number; demographie: number;
  immigrationPressure: number; logement: number; cohesion: number;
};

export type Intl = {
  reputation: number;      // 0-100
  europeWeight: number;    // 0-100
  armyStrength: number;    // 0-100
  armyMorale: number;      // 0-100
  ammoStock: number;       // 0-100
  deterrence: number;      // 0-100
  atWar: string[];         // théâtres actifs (labels)
  relations: Record<PaysId, number>; // -100..+100
};

/** Effet : patch partiel et additif sur l'état + drapeaux. */
export type Effet = {
  macro?: Partial<Record<keyof Macro, number>>;
  economy?: Partial<Record<keyof Economy, number>>;
  society?: Partial<Record<keyof Society, number>>;
  politics?: {
    popularity?: number; capital?: number; pmRelation?: number;
    ministerMorale?: number; socialTension?: number; institutionalTrust?: number;
  };
  groups?: Partial<Record<Group, number>>;
  assembly?: Partial<Record<Famille, number>>; // effet sur le soutien
  intl?: {
    reputation?: number; europeWeight?: number; armyStrength?: number;
    armyMorale?: number; ammoStock?: number; deterrence?: number;
  };
  relations?: Partial<Record<PaysId, number>>;
  /** Impact direct sur le solde public (Md€/an, + = amélioration). */
  budgetMdEUR?: number;
  /** Modificateur permanent du solde primaire (% PIB, + = consolidation). */
  primaryBalancePct?: number;
  /** Variation ponctuelle du stock de dette (Md€, - = désendettement). */
  debtOneOff?: number;
  /** Choc de croissance (pts, appliqué à la cible de croissance). */
  growthShock?: number;
  /** Choc énergétique (alimente l'inflation). */
  energyShock?: number;
  flags?: string[];       // drapeaux narratifs à poser
  clearFlags?: string[];  // drapeaux à retirer
};

/** Condition d'éligibilité déclarative. */
export type Condition =
  | { path: string; op: '<' | '<=' | '>' | '>=' | '==' | '!='; value: number }
  | { flag: string; present?: boolean }
  | { phase: Phase }
  | { minTurn?: number; maxTurn?: number }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type Cout = { capital: number; actionPoints: number };

export type Measure = {
  id: string;
  titre: string;
  domaine: Domaine;
  famille: Famille;          // couleur politique dominante de la mesure
  description: string;       // info-bulle pédagogique
  cout: Cout;
  delaiTours?: number;       // effet principal différé (0 = immédiat)
  effets?: Effet;            // effet immédiat
  effetsDiffered?: Effet;    // effet à turn + delaiTours
  risques?: string[];
  conditions?: Condition;
  oneShot?: boolean;
  tags?: string[];
  pouvoir?: boolean;         // pouvoir constitutionnel (traité à part)
  source_ou_ordre_de_grandeur: string;
};

export type EventChoice = {
  label: string;
  effets?: Effet;
  suite?: string;            // id de l'événement enchaîné
  cout?: { capital?: number };
  requiert?: Condition;      // choix seulement disponible si vrai
  source_ou_ordre_de_grandeur?: string;
};

export type GameEvent = {
  id: string;
  titre: string;
  categorie: Categorie;
  texte: string;
  poids: number;
  conditions?: Condition;
  choix: EventChoice[];
  chaine?: string;
  oneShot?: boolean;
  forced?: boolean;          // événement scénarisé (déclenché par le moteur)
  source_ou_ordre_de_grandeur: string;
};

// ---------------------------------------------------------------------------
// Journal, historique, méta
// ---------------------------------------------------------------------------

export type Snapshot = {
  turn: number;
  label: string;
  deficitPct: number;
  debtPct: number;
  popularity: number;
  growth: number;
  unemployment: number;
  capital: number;
  socialTension: number;
};

export type JournalEntry = {
  turn: number;
  label: string;
  type: 'mesure' | 'evenement' | 'depeche' | 'election' | 'systeme';
  texte: string;
};

/** Explication pédagogique d'une variation de jauge sur le tour. */
export type Explain = { label: string; delta: number; raison: string };

export type CandidateResult = {
  id: string; nom: string; famille: Famille; part: number; joueur: boolean;
};
export type ElectionResult = {
  tour: 1 | 2;
  abstention: number;
  candidats: CandidateResult[];
  gagnant?: string;
  joueurQualifie: boolean;
  joueurGagnant: boolean;
};

export type PendingEffect = { dueTurn: number; effet: Effet; label: string };

export type Meta = {
  turn: number;
  year: number;
  month: number;      // 1-12
  dateLabel: string;  // "T3 2026", "Avril 2027"...
  phase: Phase;
  seed: string;
  rngState: number;
  profile: ProfileId;
  difficulty: Difficulty;
  mode: Mode;
  mandat: number;               // 1 = mandat en cours, 2 = réélu
  seRepresente: boolean;
  promises: string[];           // ids de mesures promises en campagne
  keptPromises: number;
  brokenPromises: number;
  flags: string[];
  achievements: string[];
  pendingEffects: PendingEffect[];
  usedMeasures: string[];       // ids de mesures oneShot déjà jouées
  firedEvents: string[];        // ids d'événements oneShot déjà déclenchés
  advisorBiasSeed: number;      // biais des conseillers (fiabilité variable)
  campaignActions: number;      // actions de campagne accumulées
  queuedEvents: string[];       // événements enchaînés à déclencher au prochain tour
  dangerCounters: Record<string, number>; // compteurs d'hystérésis des défaites
};

export type EndInfo = {
  victoire: boolean;
  raison: string;
  titre: string;
  note: string;         // A+ ... F
  score: number;        // 0-100
  bilan: string;        // texte "manuel d'histoire"
  objectifs: { label: string; atteint: boolean }[];
};

/** Accumulateurs transitoires consommés par la mise à jour macro du tour. */
export type Scratch = {
  growthShock: number;   // pts, appliqués à la prochaine cible de croissance
  energyShock: number;   // alimente l'inflation
  prevPrimary: number;   // solde primaire au tour précédent (impulsion budgétaire)
};

export type GameState = {
  meta: Meta;
  scratch: Scratch;
  macro: Macro;
  economy: Economy;
  politics: Politics;
  society: Society;
  intl: Intl;
  history: Snapshot[];
  journal: JournalEntry[];
  depeches: string[];          // dépêches du tour courant
  explain: Explain[];          // explications pédagogiques du dernier tour
  currentEvents: string[];     // ids d'événements à traiter ce tour
  lastElection?: ElectionResult;
  end?: EndInfo;
};
