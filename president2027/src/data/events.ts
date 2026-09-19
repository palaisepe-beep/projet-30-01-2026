import type { GameEvent } from '../engine/types.ts';

// Événements avec conditions de déclenchement et arbres de choix. `poids` =
// probabilité relative. Certains sont enchaînés (`suite` -> `forced` event).
// Ordres de grandeur signalés. Ton : dépêches, un peu d'humour sec.

export const ALL_EVENTS: GameEvent[] = [
  // ------------------------- ÉCONOMIQUES --------------------------------
  {
    id: 'ev_taux', titre: 'Remontée des taux', categorie: 'economique',
    texte: 'Les marchés réévaluent le risque : les taux longs montent. Bercy s\'inquiète du coût de refinancement.',
    poids: 10, conditions: { path: 'macro.debtPct', op: '>', value: 116 },
    choix: [
      { label: 'Rassurer par un plan d\'économies crédible', effets: { budgetMdEUR: 3, macro: { spread: -15 }, politics: { socialTension: 4, capital: -4 } } },
      { label: 'Ne rien changer, tenir le cap', effets: { macro: { spread: 20 } } },
      { label: 'Dénoncer la spéculation (com)', effets: { macro: { spread: 8 }, groups: { classesPopulaires: 3 }, intl: { reputation: -2 } } },
    ],
    source_ou_ordre_de_grandeur: '+100 bps de taux ≈ +plusieurs Md€ de charge à terme.',
  },
  {
    id: 'ev_faillite', titre: 'Un géant industriel au bord de la faillite', categorie: 'economique',
    texte: 'Un fleuron industriel menace de déposer le bilan : 12 000 emplois en jeu dans plusieurs régions.',
    poids: 7,
    choix: [
      { label: 'Nationalisation temporaire', effets: { budgetMdEUR: -4, debtOneOff: 3, groups: { classesPopulaires: 8, fonctionnaires: 4, patrons: -3 }, economy: { businessConfidence: -2 } } },
      { label: 'Prêt garanti par l\'État', effets: { budgetMdEUR: -1, groups: { patrons: 5, classesPopulaires: 3 } } },
      { label: 'Laisser jouer le marché', effets: { economy: { unemployment: 0.3, businessConfidence: 2 }, groups: { classesPopulaires: -8, ruralite: -5 }, politics: { socialTension: 8 } } },
    ],
    source_ou_ordre_de_grandeur: 'Sauvetage industriel : 1-5 Md€ selon le dossier.',
  },
  {
    id: 'ev_energie_choc', titre: 'Choc énergétique', categorie: 'economique',
    texte: 'Une crise géopolitique fait bondir le prix du gaz et de l\'électricité. Les factures explosent.',
    poids: 8,
    choix: [
      { label: 'Bouclier tarifaire d\'urgence', effets: { budgetMdEUR: -8, energyShock: 1, economy: { inflation: 0.3 }, groups: { classesPopulaires: 8, retraites: 5 } } },
      { label: 'Chèque énergie ciblé', effets: { budgetMdEUR: -3, energyShock: 1.5, groups: { classesPopulaires: 5 } } },
      { label: 'Laisser filer les prix', effets: { energyShock: 2.5, economy: { inflation: 0.6, purchasingPower: -4 }, politics: { socialTension: 8 }, groups: { classesPopulaires: -8 } } },
    ],
    source_ou_ordre_de_grandeur: 'Crise 2022 : prix x3-x5, boucliers à dizaines de Md€.',
  },
  {
    id: 'ev_bonne_surprise', titre: 'Bonne surprise sur la croissance', categorie: 'positif',
    texte: 'L\'Insee révise la croissance à la hausse : les recettes fiscales rentrent mieux que prévu.',
    poids: 6,
    choix: [
      { label: 'Consacrer la cagnotte au désendettement', effets: { debtOneOff: -5, macro: { spread: -6 }, groups: { cadres: 3 } } },
      { label: 'Redistribuer aux ménages', effets: { budgetMdEUR: -3, economy: { purchasingPower: 4 }, groups: { classesPopulaires: 6, classesMoyennes: 4 } } },
      { label: 'Investir dans les services publics', effets: { budgetMdEUR: -3, society: { sante: 3, education: 3 } } },
    ],
    source_ou_ordre_de_grandeur: '0,3 pt de croissance surprise ≈ quelques Md€ de recettes.',
  },
  {
    id: 'ev_cyber', titre: 'Cyberattaque massive', categorie: 'technologique',
    texte: 'Une attaque paralyse des hôpitaux et des services publics. La rançon est réclamée en cryptomonnaie.',
    poids: 6,
    choix: [
      { label: 'Plan cyber national d\'urgence', effets: { budgetMdEUR: -2, society: { securite: 3 }, intl: { reputation: 2 }, groups: { cadres: 3 } } },
      { label: 'Gérer discrètement', effets: { society: { sante: -3, securite: -3 }, politics: { institutionalTrust: -4 } } },
    ],
    source_ou_ordre_de_grandeur: 'Coût d\'une cyberattaque majeure : centaines de M€.',
  },

  // ------------------------- SOCIAUX ------------------------------------
  {
    id: 'ev_greve', titre: 'Grève générale annoncée', categorie: 'social',
    texte: 'Les syndicats appellent à une journée de mobilisation nationale contre votre politique.',
    poids: 9, conditions: { path: 'politics.socialTension', op: '>', value: 55 },
    choix: [
      { label: 'Ouvrir des négociations', effets: { budgetMdEUR: -2, politics: { socialTension: -8, capital: -4 }, groups: { fonctionnaires: 4, classesPopulaires: 3 } } },
      { label: 'Tenir bon et minimiser', effets: { politics: { socialTension: 6 }, groups: { fonctionnaires: -4 } }, suite: 'ev_greve_suite' },
      { label: 'Réquisitionner les services essentiels', effets: { politics: { socialTension: 10, institutionalTrust: -3 }, groups: { classesPopulaires: -6, patrons: 5 } } },
    ],
    source_ou_ordre_de_grandeur: 'Grève nationale : coût économique de plusieurs centaines de M€/jour.',
  },
  {
    id: 'ev_greve_suite', titre: 'La grève se durcit', categorie: 'social', forced: true,
    texte: 'Le mouvement s\'ancre : blocages de raffineries, transports paralysés. L\'opinion se lasse — de qui ?',
    poids: 0,
    choix: [
      { label: 'Concéder pour sortir de la crise', effets: { budgetMdEUR: -4, politics: { socialTension: -12, capital: -6 }, groups: { classesPopulaires: 5, fonctionnaires: 5 } } },
      { label: 'Épreuve de force jusqu\'au bout', effets: { politics: { socialTension: 8 }, economy: { growth: -0.2 }, groups: { patrons: 4, classesPopulaires: -6 } } },
    ],
    source_ou_ordre_de_grandeur: 'Blocages prolongés : impact sur la croissance trimestrielle.',
  },
  {
    id: 'ev_gilets', titre: 'Mouvement spontané type « Gilets jaunes »', categorie: 'social',
    texte: 'Une colère fiscale et territoriale déborde des cadres syndicaux. Ronds-points occupés, samedis tendus.',
    poids: 7, conditions: { all: [{ path: 'economy.purchasingPower', op: '<', value: 45 }, { path: 'politics.socialTension', op: '>', value: 60 }] },
    choix: [
      { label: 'Geste fiscal massif + grand débat', effets: { budgetMdEUR: -6, politics: { socialTension: -12, capital: -6 }, groups: { ruralite: 8, classesPopulaires: 8 } } },
      { label: 'Maintien de l\'ordre ferme', effets: { politics: { socialTension: 6, institutionalTrust: -4 }, society: { securite: -2 }, groups: { ruralite: -4 } } },
      { label: 'Attendre l\'essoufflement', effets: { politics: { socialTension: 4 }, groups: { classesPopulaires: -4 } } },
    ],
    source_ou_ordre_de_grandeur: 'Réponse « Gilets jaunes » 2018 : ~10 Md€ de mesures.',
  },
  {
    id: 'ev_emeutes', titre: 'Émeutes urbaines', categorie: 'social',
    texte: 'Un drame déclenche des nuits d\'émeutes dans plusieurs villes. Commerces pillés, bâtiments publics visés.',
    poids: 6, conditions: { any: [{ path: 'society.securite', op: '<', value: 38 }, { path: 'politics.socialTension', op: '>', value: 70 }] },
    choix: [
      { label: 'État d\'urgence localisé + renforts', effets: { politics: { socialTension: 4, institutionalTrust: 2 }, society: { securite: 2 }, groups: { ruralite: 4, banlieues: -6 } } },
      { label: 'Plan banlieues et dialogue', effets: { budgetMdEUR: -3, society: { cohesion: 3 }, groups: { banlieues: 8, ruralite: -3 } } },
      { label: 'Fermeté médiatique maximale', effets: { politics: { socialTension: 8 }, groups: { ruralite: 5, banlieues: -10 }, society: { cohesion: -4 } } },
    ],
    source_ou_ordre_de_grandeur: 'Émeutes 2023 : ~1 Md€ de dégâts.',
  },
  {
    id: 'ev_agriculteurs', titre: 'Colère agricole', categorie: 'social',
    texte: 'Tracteurs sur les autoroutes, préfectures assiégées : les agriculteurs dénoncent normes et revenus.',
    poids: 6, conditions: { path: 'politics.groups.agriculteurs', op: '<', value: 45 },
    choix: [
      { label: 'Moratoire sur les normes + aides', effets: { budgetMdEUR: -2, society: { ecologie: -3 }, groups: { agriculteurs: 12, ruralite: 6 } } },
      { label: 'Prix planchers négociés', effets: { groups: { agriculteurs: 8, patrons: -3 }, economy: { businessConfidence: -2 } } },
      { label: 'Rappeler les engagements écologiques', effets: { society: { ecologie: 3 }, groups: { agriculteurs: -8, jeunes: 3 }, politics: { socialTension: 6 } } },
    ],
    source_ou_ordre_de_grandeur: 'Aides d\'urgence agricoles : quelques centaines de M€ à 2 Md€.',
  },
  {
    id: 'ev_scandale_sanitaire', titre: 'Scandale sanitaire', categorie: 'social',
    texte: 'Un médicament ou un produit alimentaire se révèle dangereux. L\'agence sanitaire est mise en cause.',
    poids: 5,
    choix: [
      { label: 'Transparence totale et retrait', effets: { society: { sante: 2 }, politics: { institutionalTrust: 2, capital: -3 } } },
      { label: 'Temporiser en attendant les expertises', effets: { society: { sante: -4 }, politics: { institutionalTrust: -6 }, groups: { classesMoyennes: -4 } } },
    ],
    source_ou_ordre_de_grandeur: 'Crises sanitaires : coûts d\'indemnisation variables.',
  },

  // ------------------------- POLITIQUES ---------------------------------
  {
    id: 'ev_censure', titre: 'Motion de censure déposée', categorie: 'politique',
    texte: 'L\'opposition dépose une motion de censure. Le gouvernement joue sa survie à quelques voix près.',
    poids: 6, conditions: { path: 'politics.socialTension', op: '>', value: 60 },
    choix: [
      { label: 'Négocier avec un groupe pivot', effets: { politics: { capital: -8 }, assembly: { droite: 6, gaucheSociale: 4 } } },
      { label: 'Menacer de dissolution', effets: { politics: { socialTension: 4 }, assembly: { droiteNationale: -4, gaucheRadicale: -4 } } },
      { label: 'Compter sur la division de l\'opposition', effets: { politics: { capital: -2 } }, suite: 'ev_censure_vote' },
    ],
    source_ou_ordre_de_grandeur: 'Majorité requise : 289 voix.',
  },
  {
    id: 'ev_censure_vote', titre: 'Le vote de la censure', categorie: 'politique', forced: true,
    texte: 'L\'Assemblée vote. Le décompte est serré...',
    poids: 0,
    choix: [
      { label: 'Assumer le résultat', effets: { politics: { socialTension: 4 } } },
    ],
    source_ou_ordre_de_grandeur: 'Le moteur résout le risque de censure séparément.',
  },
  {
    id: 'ev_ministre_demission', titre: 'Un ministre menace de démissionner', categorie: 'politique',
    texte: 'Un ministre en désaccord avec votre ligne menace de claquer la porte, avec fracas médiatique.',
    poids: 6, conditions: { path: 'politics.ministerMorale', op: '<', value: 45 },
    choix: [
      { label: 'Le retenir avec des gages', effets: { politics: { ministerMorale: 10, capital: -4 } } },
      { label: 'Accepter et remanier', effets: { politics: { ministerMorale: 4, pmRelation: -4 }, groups: { classesMoyennes: -2 } } },
      { label: 'Le limoger publiquement', effets: { politics: { ministerMorale: -8, institutionalTrust: -3 }, groups: { cadres: -3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Crise ministérielle : effet d\'image.',
  },
  {
    id: 'ev_affaire', titre: 'Une « affaire » éclabousse l\'exécutif', categorie: 'politique',
    texte: 'La presse révèle un possible conflit d\'intérêts au sommet de l\'État. La justice pourrait s\'en mêler.',
    poids: 6,
    choix: [
      { label: 'Enquête indépendante immédiate', effets: { politics: { institutionalTrust: 3, capital: -4 } } },
      { label: 'Contre-attaquer et minimiser', effets: { politics: { institutionalTrust: -6 }, groups: { classesMoyennes: -4, cadres: -3 } }, suite: 'ev_affaire_suite' },
      { label: 'Sacrifier le responsable', effets: { politics: { ministerMorale: -6, institutionalTrust: 1 } } },
    ],
    source_ou_ordre_de_grandeur: 'Affaires : effet d\'opinion durable si mal gérées.',
  },
  {
    id: 'ev_affaire_suite', titre: 'L\'affaire enfle', categorie: 'politique', forced: true,
    texte: 'De nouveaux documents fuitent. Le déni ne tient plus.',
    poids: 0,
    choix: [
      { label: 'Faire toute la lumière, tardivement', effets: { politics: { institutionalTrust: -3, capital: -6 } } },
      { label: 'Verrouiller encore', effets: { politics: { institutionalTrust: -10 }, groups: { jeunes: -4, classesMoyennes: -5 } } },
    ],
    source_ou_ordre_de_grandeur: 'Escalade médiatique.',
  },
  {
    id: 'ev_trahison', titre: 'Trahison d\'un allié politique', categorie: 'politique',
    texte: 'Un allié de la majorité annonce faire bande à part, emportant une poignée de députés.',
    poids: 5,
    choix: [
      { label: 'Recomposer la majorité', effets: { politics: { capital: -6 }, assembly: { centre: -4, droite: 4 } } },
      { label: 'Assumer une majorité plus étroite', effets: { assembly: { centre: -6 }, politics: { socialTension: 3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Recomposition parlementaire.',
  },

  // ------------------------- INTERNATIONAUX -----------------------------
  {
    id: 'ev_escalade_russe', titre: 'Escalade russe', categorie: 'international',
    texte: 'La Russie intensifie ses frappes et teste les défenses de l\'OTAN aux frontières de l\'Est.',
    poids: 7,
    choix: [
      { label: 'Renforcer le flanc est de l\'OTAN', effets: { budgetMdEUR: -2, intl: { reputation: 4, ammoStock: -6 }, relations: { pologne: 6, usa: 4, russie: -8 } } },
      { label: 'Appeler à la désescalade diplomatique', effets: { intl: { reputation: 1 }, relations: { russie: 3, ukraine: -5, pologne: -4 } } },
      { label: 'Ligne de fermeté maximale', effets: { intl: { deterrence: 3, ammoStock: -4 }, relations: { russie: -12, ukraine: 6 }, politics: { socialTension: 4 } }, suite: 'ev_russie_ultimatum' },
    ],
    source_ou_ordre_de_grandeur: 'Renforts OTAN : coûts opérationnels de plusieurs centaines de M€.',
  },
  {
    id: 'ev_russie_ultimatum', titre: 'Bras de fer avec Moscou', categorie: 'international', forced: true,
    texte: 'Moscou répond par des menaces voilées et une cyberoffensive. Le risque d\'engrenage grandit.',
    poids: 0,
    choix: [
      { label: 'Tenir la ligne avec les alliés', effets: { intl: { reputation: 3, deterrence: 2 }, relations: { usa: 4, allemagne: 3 }, politics: { socialTension: 3 } } },
      { label: 'Chercher un canal de négociation discret', effets: { relations: { russie: 4, ukraine: -6 }, intl: { reputation: -3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Gestion de crise : pas d\'engagement direct.',
  },
  {
    id: 'ev_taiwan', titre: 'Tensions autour de Taïwan', categorie: 'international',
    texte: 'La Chine multiplie les manœuvres près de Taïwan. Les chaînes d\'approvisionnement mondiales tremblent.',
    poids: 5,
    choix: [
      { label: 'Position d\'équilibre prudente', effets: { relations: { chine: 2, usa: -2 }, intl: { reputation: 1 } } },
      { label: 'Aligner sur les alliés (fermeté)', effets: { relations: { usa: 5, chine: -8 }, economy: { tradeBalance: -0.3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Semi-conducteurs : dépendance stratégique majeure.',
  },
  {
    id: 'ev_coup_afrique', titre: 'Coup d\'État en Afrique', categorie: 'international',
    texte: 'Une junte renverse un gouvernement allié. Nos ressortissants et nos intérêts sont exposés.',
    poids: 5,
    choix: [
      { label: 'Évacuation des ressortissants', effets: { budgetMdEUR: -1, intl: { reputation: 2 }, relations: { sahel: -3 } } },
      { label: 'Reconnaître la nouvelle réalité', effets: { relations: { sahel: 3, russie: -2 }, intl: { reputation: -3 } } },
      { label: 'Sanctions et isolement de la junte', effets: { relations: { sahel: -8 }, intl: { reputation: 2 } } },
    ],
    source_ou_ordre_de_grandeur: 'Opérations d\'évacuation : coûts logistiques.',
  },
  {
    id: 'ev_attentat', titre: 'Attentat terroriste', categorie: 'international',
    texte: 'Un attentat frappe le pays. Émotion nationale, appel à l\'unité — et pression sécuritaire immédiate.',
    poids: 5, conditions: { path: 'society.securite', op: '<', value: 50 },
    choix: [
      { label: 'Unité nationale et plan Vigipirate renforcé', effets: { budgetMdEUR: -1, society: { securite: 2, cohesion: 3 }, politics: { capital: 4 }, groups: { ruralite: 4, retraites: 4 } } },
      { label: 'Lois d\'exception sécuritaires', effets: { society: { securite: 4, justice: -3 }, politics: { institutionalTrust: -4 }, groups: { banlieues: -6 } } },
    ],
    source_ou_ordre_de_grandeur: 'Effet « union sacrée » court, exigence sécuritaire durable.',
  },
  {
    id: 'ev_migratoire', titre: 'Crise migratoire en Méditerranée', categorie: 'international',
    texte: 'Des arrivées massives saturent les dispositifs d\'accueil. L\'Europe se déchire sur la répartition.',
    poids: 6, conditions: { path: 'society.immigrationPressure', op: '>', value: 55 },
    choix: [
      { label: 'Solution européenne coordonnée', effets: { intl: { europeWeight: 3 }, relations: { italie: 5, allemagne: 3 }, society: { immigrationPressure: -2 } } },
      { label: 'Contrôles aux frontières renforcés', effets: { society: { immigrationPressure: -3 }, groups: { ruralite: 5, banlieues: -3 }, intl: { europeWeight: -2 } } },
      { label: 'Accueil humanitaire assumé', effets: { society: { cohesion: 2, immigrationPressure: 2 }, groups: { banlieues: 5, ruralite: -6 }, politics: { socialTension: 5 } } },
    ],
    source_ou_ordre_de_grandeur: 'Pacte migratoire européen comme cadre.',
  },
  {
    id: 'ev_dirigeant_ami', titre: 'Un dirigeant allié élu à l\'étranger', categorie: 'positif',
    texte: 'Un partenaire européen porte au pouvoir un dirigeant proche de vos vues. Une fenêtre s\'ouvre.',
    poids: 4,
    choix: [
      { label: 'Sceller une alliance stratégique', effets: { intl: { europeWeight: 4, reputation: 2 }, relations: { allemagne: 6, italie: 4 } } },
      { label: 'Rester prudent', effets: { intl: { europeWeight: 1 } } },
    ],
    source_ou_ordre_de_grandeur: 'Alignement politique en Europe.',
  },
  {
    id: 'ev_guerre_commerciale', titre: 'Guerre commerciale', categorie: 'international',
    texte: 'Une grande puissance impose des droits de douane massifs. Nos exportateurs sont menacés.',
    poids: 5,
    choix: [
      { label: 'Riposte européenne coordonnée', effets: { intl: { europeWeight: 3 }, relations: { usa: -6 }, economy: { tradeBalance: -0.3 } } },
      { label: 'Négocier des exemptions', effets: { relations: { usa: 3 }, economy: { competitiveness: -2 } } },
    ],
    source_ou_ordre_de_grandeur: 'Droits de douane : impact sur la balance commerciale.',
  },

  // ------------------------- NATURELS -----------------------------------
  {
    id: 'ev_canicule', titre: 'Canicule extrême', categorie: 'naturel',
    texte: 'Une vague de chaleur record menace les personnes fragiles et les cultures. Le réseau électrique est sous tension.',
    poids: 6,
    choix: [
      { label: 'Plan canicule renforcé', effets: { budgetMdEUR: -1, society: { sante: 2 }, groups: { retraites: 5 } } },
      { label: 'Réponse minimale', effets: { society: { sante: -3 }, groups: { retraites: -5 }, politics: { institutionalTrust: -3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Surmortalité et pertes agricoles : centaines de M€.',
  },
  {
    id: 'ev_inondations', titre: 'Inondations catastrophiques', categorie: 'naturel',
    texte: 'Des crues dévastent plusieurs départements. Des milliers de sinistrés attendent l\'État.',
    poids: 6,
    choix: [
      { label: 'Fonds d\'urgence et reconstruction', effets: { budgetMdEUR: -3, debtOneOff: 1, society: { cohesion: 3 }, groups: { ruralite: 6, classesPopulaires: 4 } } },
      { label: 'Reconstruction au fil de l\'eau', effets: { society: { cohesion: -3 }, groups: { ruralite: -6 }, politics: { institutionalTrust: -3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Catastrophe naturelle majeure : 1-3 Md€.',
  },
  {
    id: 'ev_incendies', titre: 'Méga-feux de forêt', categorie: 'naturel',
    texte: 'Des incendies géants ravagent le sud. La question des moyens de la Sécurité civile revient en force.',
    poids: 5,
    choix: [
      { label: 'Investir dans la Sécurité civile (Canadairs)', effets: { budgetMdEUR: -2, society: { securite: 3, ecologie: 2 }, groups: { ruralite: 6 } } },
      { label: 'Compter sur l\'entraide européenne', effets: { intl: { europeWeight: 2 }, society: { ecologie: -1 } } },
    ],
    source_ou_ordre_de_grandeur: 'Flotte aérienne : investissements de plusieurs centaines de M€.',
  },

  // ------------------------- TECHNOLOGIQUES -----------------------------
  {
    id: 'ev_ia', titre: 'Rupture de l\'IA sur l\'emploi', categorie: 'technologique',
    texte: 'Une vague d\'automatisation par IA inquiète des secteurs entiers. Opportunité ou destruction d\'emplois ?',
    poids: 5,
    choix: [
      { label: 'Stratégie IA + formation massive', effets: { budgetMdEUR: -3, economy: { competitiveness: 3 }, groups: { jeunes: 4, cadres: 3 } } },
      { label: 'Réguler et protéger l\'emploi', effets: { economy: { competitiveness: -2 }, groups: { classesPopulaires: 4, fonctionnaires: 3 } } },
      { label: 'Laisser faire le marché', effets: { economy: { competitiveness: 2, unemployment: 0.2 }, groups: { patrons: 5, classesPopulaires: -5 } } },
    ],
    source_ou_ordre_de_grandeur: 'IA générative : effet emploi débattu, fort enjeu de souveraineté.',
  },
  {
    id: 'ev_desinfo', titre: 'Campagne de désinformation', categorie: 'technologique',
    texte: 'Une opération d\'ingérence inonde les réseaux de fausses informations visant l\'État.',
    poids: 5,
    choix: [
      { label: 'Riposte transparente + éducation aux médias', effets: { society: { cohesion: 2 }, politics: { institutionalTrust: 3 }, relations: { russie: -4 } } },
      { label: 'Ignorer pour ne pas amplifier', effets: { politics: { institutionalTrust: -3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Ingérences numériques : menace hybride croissante.',
  },

  // ------------------------- CAMPAGNE (2027) ----------------------------
  {
    id: 'ev_debat_tele', titre: 'Débat télévisé décisif', categorie: 'politique',
    texte: 'Face aux autres candidats, chaque phrase compte. Quelle posture adoptez-vous ?',
    poids: 12, conditions: { phase: 'CAMPAGNE' },
    choix: [
      { label: 'Défendre votre bilan avec chiffres', effets: { groups: { cadres: 5, classesMoyennes: 4 }, politics: { capital: 3 } } },
      { label: 'Attaquer frontalement l\'extrême', effets: { groups: { jeunes: 4, banlieues: 4, ruralite: -3 }, politics: { socialTension: 3 } } },
      { label: 'Jouer l\'apaisement et le rassemblement', effets: { groups: { retraites: 4, classesMoyennes: 3 }, society: { cohesion: 2 } } },
      { label: 'Promesse choc de pouvoir d\'achat', effets: { groups: { classesPopulaires: 6 }, politics: { capital: -2 } }, requiert: { path: 'politics.capital', op: '>=', value: 5 } },
    ],
    source_ou_ordre_de_grandeur: 'Débats de l\'entre-deux-tours : audiences massives, effet réel.',
  },
  {
    id: 'ev_meeting', titre: 'Grand meeting de campagne', categorie: 'politique',
    texte: 'Un meeting géant se prépare. L\'occasion de mobiliser — ou de trébucher.',
    poids: 10, conditions: { phase: 'CAMPAGNE' },
    choix: [
      { label: 'Discours de fond et d\'espoir', effets: { politics: { capital: 4 }, groups: { classesMoyennes: 3, jeunes: 3 } } },
      { label: 'Discours offensif contre les sortants... euh, vous', effets: { groups: { classesPopulaires: 4 }, society: { cohesion: -1 } } },
    ],
    source_ou_ordre_de_grandeur: 'Meetings : mobilisation du socle électoral.',
  },
  {
    id: 'ev_deepfake', titre: 'Deepfake en pleine campagne', categorie: 'technologique',
    texte: 'Une vidéo truquée vous montre tenant des propos scandaleux. Elle devient virale en quelques heures.',
    poids: 8, conditions: { phase: 'CAMPAGNE' },
    choix: [
      { label: 'Démenti immédiat + plainte', effets: { politics: { institutionalTrust: 2 }, groups: { jeunes: 2 } } },
      { label: 'Laisser retomber', effets: { groups: { classesMoyennes: -4, jeunes: -3 }, politics: { capital: -3 } } },
      { label: 'En faire un moment d\'humour et de pédagogie', effets: { groups: { jeunes: 5 }, society: { cohesion: 1 } } },
    ],
    source_ou_ordre_de_grandeur: 'Deepfakes électoraux : menace émergente 2024-2027.',
  },
  {
    id: 'ev_ralliement', titre: 'Un ralliement de dernière minute', categorie: 'positif',
    texte: 'Une personnalité influente propose de vous soutenir — en échange de garanties.',
    poids: 7, conditions: { phase: 'CAMPAGNE' },
    choix: [
      { label: 'Accepter et promettre un ministère', effets: { politics: { capital: 4 }, groups: { cadres: 3, classesMoyennes: 2 } } },
      { label: 'Refuser pour rester libre', effets: { society: { cohesion: 1 }, politics: { capital: -1 } } },
    ],
    source_ou_ordre_de_grandeur: 'Alliances de second tour : reports de voix.',
  },

  // ------------------------- POSITIFS DIVERS ----------------------------
  {
    id: 'ev_sport', titre: 'Exploit sportif national', categorie: 'positif',
    texte: 'Les Bleus triomphent dans une grande compétition. Liesse populaire, drapeaux aux fenêtres.',
    poids: 4,
    choix: [
      { label: 'Communier avec la nation', effets: { society: { cohesion: 4 }, politics: { capital: 2 }, groups: { jeunes: 3, classesPopulaires: 3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Effet « feel good » national court.',
  },
  {
    id: 'ev_succes_diplo', titre: 'Succès diplomatique inattendu', categorie: 'positif',
    texte: 'Une médiation française aboutit à un accord salué dans le monde entier.',
    poids: 4, conditions: { path: 'intl.reputation', op: '>', value: 55 },
    choix: [
      { label: 'Capitaliser sur le prestige', effets: { intl: { reputation: 5, europeWeight: 3 }, politics: { capital: 3 }, groups: { cadres: 3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Gain d\'image et de poids international.',
  },
  {
    id: 'ev_jo', titre: 'Grand événement international en France', categorie: 'positif',
    texte: 'La France accueille un événement mondial majeur. Vitrine planétaire, sécurité et logistique sous pression.',
    poids: 4,
    choix: [
      { label: 'Miser gros sur l\'organisation', effets: { budgetMdEUR: -2, intl: { reputation: 4 }, society: { cohesion: 3 }, groups: { jeunes: 3 } } },
      { label: 'Organisation sobre et maîtrisée', effets: { intl: { reputation: 2 }, groups: { cadres: 2 } } },
    ],
    source_ou_ordre_de_grandeur: 'Grand événement : coûts et retombées de plusieurs Md€.',
  },
  {
    id: 'ev_pandemie', titre: 'Alerte pandémique', categorie: 'social',
    texte: 'Un nouveau virus émerge à l\'étranger. L\'OMS s\'inquiète. Faut-il anticiper ?',
    poids: 4,
    choix: [
      { label: 'Plan de préparation immédiat', effets: { budgetMdEUR: -2, society: { sante: 3 }, politics: { capital: -2 } } },
      { label: 'Attendre d\'en savoir plus', effets: { society: { sante: -2 } }, suite: 'ev_pandemie_suite' },
    ],
    source_ou_ordre_de_grandeur: 'Préparation pandémique : coûts de stocks stratégiques.',
  },
  {
    id: 'ev_pandemie_suite', titre: 'La pandémie se propage', categorie: 'social', forced: true,
    texte: 'Le virus arrive. Les hôpitaux se remplissent. Confiner ou non ?',
    poids: 0,
    choix: [
      { label: 'Restrictions ciblées', effets: { budgetMdEUR: -4, economy: { growth: -0.3 }, society: { sante: 3 }, politics: { socialTension: 5 } } },
      { label: 'Confinement large', effets: { budgetMdEUR: -10, economy: { growth: -0.8, unemployment: 0.4 }, society: { sante: 5 }, politics: { socialTension: 8 } } },
      { label: 'Vivre avec le virus', effets: { society: { sante: -6 }, groups: { retraites: -8 }, politics: { institutionalTrust: -5 } } },
    ],
    source_ou_ordre_de_grandeur: 'Confinement : coût de plusieurs pts de PIB (Covid comme repère).',
  },

  // ------------------------- ÉCONOMIQUES (suite) ------------------------
  {
    id: 'ev_crise_bancaire', titre: 'Crise bancaire', categorie: 'economique',
    texte: 'Une grande banque vacille. Le risque de contagion au système financier est réel.',
    poids: 5, conditions: { path: 'macro.spread', op: '>', value: 150 },
    choix: [
      { label: 'Garantir les dépôts et recapitaliser', effets: { budgetMdEUR: -6, debtOneOff: 10, macro: { spread: -10 }, economy: { businessConfidence: 3 }, groups: { patrons: 4 } } },
      { label: 'Laisser jouer la résolution ordonnée', effets: { macro: { spread: 30 }, economy: { businessConfidence: -8, growth: -0.4 }, politics: { socialTension: 6 } } },
    ],
    source_ou_ordre_de_grandeur: 'Sauvetage bancaire : dizaines de Md€ (2008 comme repère).',
  },
  {
    id: 'ev_attaque_speculative', titre: 'Attaque spéculative sur la dette', categorie: 'economique',
    texte: 'Les marchés testent la signature française : le spread s\'écarte brutalement en séance.',
    poids: 5, conditions: { path: 'macro.debtPct', op: '>', value: 122 },
    choix: [
      { label: 'Plan de crédibilité + soutien de la BCE', effets: { budgetMdEUR: 4, macro: { spread: -25 }, intl: { europeWeight: 2 }, politics: { socialTension: 4 } } },
      { label: 'Fustiger les marchés (sans agir)', effets: { macro: { spread: 35 }, intl: { reputation: -3 }, groups: { classesPopulaires: 3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Écartement de spread : ordre de +50-150 bps en crise.',
  },

  // ------------------------- INTERNATIONAUX (suite) ---------------------
  {
    id: 'ev_dirigeant_hostile', titre: 'Un dirigeant hostile élu à l\'étranger', categorie: 'international',
    texte: 'Une grande puissance porte au pouvoir un dirigeant ouvertement hostile à l\'UE et à la France.',
    poids: 5,
    choix: [
      { label: 'Renforcer l\'autonomie stratégique européenne', effets: { intl: { europeWeight: 4 }, relations: { allemagne: 4 }, economy: { competitiveness: -1 } } },
      { label: 'Tenter l\'apaisement bilatéral', effets: { intl: { reputation: -2 }, relations: { usa: 3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Recomposition géopolitique.',
  },
  {
    id: 'ev_guerre_escalade', titre: 'Escalade sur un théâtre où la France est engagée', categorie: 'international',
    texte: 'Là où nos armées sont déployées, la situation dégénère. Des pertes sont à craindre.',
    poids: 6, conditions: { any: [{ flag: 'opex' }, { flag: 'engagementUkraine' }] },
    choix: [
      { label: 'Renforcer l\'engagement', effets: { budgetMdEUR: -3, intl: { ammoStock: -8, armyMorale: -4 }, politics: { socialTension: 5, capital: 3 } }, suite: 'ev_guerre_bilan' },
      { label: 'Désengagement ordonné', effets: { intl: { reputation: -4, armyMorale: 3 }, politics: { socialTension: -2 }, clearFlags: ['opex'] } },
    ],
    source_ou_ordre_de_grandeur: 'Surcoûts OPEX + pertes : art. 35 pour la prolongation.',
  },
  {
    id: 'ev_guerre_bilan', titre: 'Le prix de l\'engagement', categorie: 'international', forced: true,
    texte: 'Le Parlement doit autoriser la prolongation de l\'opération au-delà de quatre mois (art. 35).',
    poids: 0,
    choix: [
      { label: 'Obtenir le vote du Parlement', effets: { politics: { capital: -4 }, intl: { armyMorale: 4, reputation: 2 } } },
      { label: 'Retrait faute de soutien', effets: { intl: { reputation: -5, armyMorale: -3 }, clearFlags: ['opex', 'engagementUkraine'] } },
    ],
    source_ou_ordre_de_grandeur: 'Autorisation parlementaire au-delà de 4 mois (art. 35).',
  },
  {
    id: 'ev_ressortissants', titre: 'Nos ressortissants pris au piège', categorie: 'international',
    texte: 'Une crise soudaine menace des centaines de Français à l\'étranger. L\'opinion attend une réaction.',
    poids: 4,
    choix: [
      { label: 'Opération d\'évacuation d\'envergure', effets: { budgetMdEUR: -1, intl: { reputation: 4, armyMorale: 2 }, politics: { capital: 3 } } },
      { label: 'Solution diplomatique lente', effets: { intl: { reputation: -3 }, politics: { institutionalTrust: -2 } } },
    ],
    source_ou_ordre_de_grandeur: 'Évacuations : opérations logistiques ponctuelles.',
  },

  // ------------------------- NATUREL / TECHNO (suite) -------------------
  {
    id: 'ev_seisme', titre: 'Séisme majeur', categorie: 'naturel',
    texte: 'Un tremblement de terre frappe une région ou un territoire d\'outre-mer. Bilan humain et dégâts lourds.',
    poids: 4,
    choix: [
      { label: 'Mobilisation nationale et fonds de reconstruction', effets: { budgetMdEUR: -3, debtOneOff: 2, society: { cohesion: 4 }, intl: { reputation: 2 } } },
      { label: 'Réponse au strict minimum', effets: { society: { cohesion: -4 }, politics: { institutionalTrust: -4 } } },
    ],
    source_ou_ordre_de_grandeur: 'Catastrophe majeure : 1-4 Md€ de reconstruction.',
  },
  {
    id: 'ev_penurie_eau', titre: 'Sécheresse et pénurie d\'eau', categorie: 'naturel',
    texte: 'Une sécheresse record impose des restrictions d\'eau. Agriculteurs et collectivités en tension.',
    poids: 5,
    choix: [
      { label: 'Plan eau (sobriété + infrastructures)', effets: { budgetMdEUR: -2, society: { ecologie: 3 }, groups: { agriculteurs: 3 } } },
      { label: 'Arbitrer en faveur de l\'agriculture', effets: { society: { ecologie: -3 }, groups: { agriculteurs: 6, jeunes: -3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Adaptation à la sécheresse : plusieurs Md€.',
  },
  {
    id: 'ev_greve_dette', titre: 'Avertissement d\'une agence de notation', categorie: 'economique',
    texte: 'Une agence place la note souveraine sous « perspective négative » et attend des actes.',
    poids: 6, conditions: { path: 'macro.deficitPct', op: '>', value: 5 },
    choix: [
      { label: 'Trajectoire budgétaire crédible', effets: { budgetMdEUR: 3, macro: { spread: -8 }, politics: { socialTension: 3 } } },
      { label: 'Contester la méthodologie', effets: { macro: { spread: 6 }, intl: { reputation: -1 } } },
    ],
    source_ou_ordre_de_grandeur: 'Perspective négative : signal précurseur d\'une dégradation.',
  },
  {
    id: 'ev_bonne_negociation_eu', titre: 'Compromis européen favorable', categorie: 'positif',
    texte: 'Un sommet européen tourne à l\'avantage de la France sur un dossier clé.',
    poids: 4, conditions: { path: 'intl.europeWeight', op: '>', value: 55 },
    choix: [
      { label: 'Valoriser la victoire diplomatique', effets: { intl: { europeWeight: 4, reputation: 3 }, macro: { spread: -5 }, politics: { capital: 3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Négociation européenne réussie.',
  },
  {
    id: 'ev_lanceur_alerte', titre: 'Un lanceur d\'alerte fait scandale', categorie: 'politique',
    texte: 'Des documents internes révèlent des dysfonctionnements de l\'État. La pression monte pour des réformes.',
    poids: 5,
    choix: [
      { label: 'Protéger le lanceur d\'alerte et réformer', effets: { politics: { institutionalTrust: 5, capital: -3 }, society: { justice: 2 } } },
      { label: 'Étouffer l\'affaire', effets: { politics: { institutionalTrust: -8 }, groups: { jeunes: -4, cadres: -3 } } },
    ],
    source_ou_ordre_de_grandeur: 'Transparence et confiance institutionnelle.',
  },
];
