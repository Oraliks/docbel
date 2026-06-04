// Procédures opérationnelles d'introduction d'une demande d'allocations (DA)
// auprès de l'ONEM, par nature de DA (TEM / GRE / INT / CTP).
//
// Contenu rédigé EN INTERNE à partir de sources confidentielles (fiches HELP
// FGTB/ABVV, rév. 2019-2020). Aucune reproduction verbatim : seule la logique
// métier (formulaires, délais, ordre, codes ONEM) est conservée et reformulée.
// Le détail des écrans et des touches de l'outil interne (AS400) est
// volontairement omis — non pertinent côté Beldoc et sensible côté FGTB.
//
// Visibilité : admin + partner uniquement. Jamais "public" ni "user" lambda.

import type { DossierProcedure } from "../types";

const COMMON_AUDIENCE = ["admin", "partner"] as const;

/// Codes ONEM communs aux 4 procédures — préfixes "type de chômage" et
/// articles d'admissibilité utilisés par le programme de paiement.
const COMMON_CODE_REFS = [
  {
    tableSlug: "s04-s36-prefixe-type-chomage",
    code: "02",
    label: "Préfixe 02 — temps plein ou temps partiel avec salaire de référence",
  },
  {
    tableSlug: "s04-s36-prefixe-type-chomage",
    code: "04",
    label: "Préfixe 04 — temps partiel volontaire / crédit-temps",
  },
  {
    tableSlug: "s04-s36-prefixe-type-chomage",
    code: "06",
    label: "Préfixe 06 — temps partiel avec maintien des droits, sans AGR",
  },
  {
    tableSlug: "s04-s36-prefixe-type-chomage",
    code: "57",
    label: "Préfixe 57 — temps partiel avec maintien des droits + AGR",
  },
  {
    tableSlug: "s04-s36-prefixe-type-chomage",
    code: "58",
    label: "Préfixe 58 — temps partiel volontaire + AGR",
  },
] as const;

const ADMISSIBILITY_REFS = [
  {
    tableSlug: "articles-admissibilite-ct",
    code: "42K30",
    label: "Conditions d'admissibilité prouvées sur base de l'article 30",
  },
  {
    tableSlug: "articles-admissibilite-ct",
    code: "42K33",
    label: "Conditions prouvées sur base de l'article 33",
  },
  {
    tableSlug: "articles-admissibilite-ct",
    code: "42L36",
    label: "Conditions prouvées sur base de l'article 36",
  },
  {
    tableSlug: "articles-admissibilite-ct",
    code: "42J30",
    label: "Mesure transitoire — statut temps plein",
  },
  {
    tableSlug: "articles-admissibilite-ct",
    code: "42J33",
    label: "Mesure transitoire — statut temps partiel",
  },
  {
    tableSlug: "articles-admissibilite-ct",
    code: "42T99",
    label: "Admissible art. 42 suite à exclusion procédure DISPO",
  },
  {
    tableSlug: "articles-admissibilite-ct",
    code: "42M99",
    label: "Non admissible — pas de droit au CT (codes 51 / 511)",
  },
] as const;

/// Étapes communes à TEM / GRE / INT pour une DA obligatoire. Paraphrase d'un
/// workflow standardisé : créer la demande, vérifier les paramètres, importer
/// l'occupation, déterminer le code chiffré, finaliser.
const COMMON_STEPS_OBLIGATOIRE = [
  {
    order: 1,
    when: "Création de la demande",
    title: "Initialiser la demande",
    description:
      "Créer une nouvelle DA dans l'outil de paiement avec la nature appropriée, la date du 1er jour de chômage temporaire concerné, et le préfixe correspondant à la situation du travailleur (temps plein, temps partiel, maintien de droits, etc.).",
  },
  {
    order: 2,
    when: "Paramètres",
    title: "Déterminer l'article d'admissibilité",
    description:
      "Lancer l'analyse CT pour identifier l'article d'admissibilité applicable. Le système propose le code (42K30, 42K33, 42L36, mesure transitoire, art. 42 suite DISPO ou non admissible).",
  },
  {
    order: 3,
    when: "Documents externes",
    title: "Demander les flux ONSS / DRS",
    description:
      "Réclamer automatiquement le C3.2 EL (flux DRS), et selon l'article d'admissibilité retenu, le DMFA et tout autre flux pertinent.",
  },
  {
    order: 4,
    when: "Import occupation",
    title: "Importer l'occupation depuis la DRS employeur",
    description:
      "Lier l'occupation au flux WECH 502 (demande) ou WECH 505 (paiement). Vérifier la cohérence des paramètres importés et alimenter les compteurs.",
  },
  {
    order: 5,
    when: "Construction (CP 124)",
    title: "Contrôler la carte d'ayant-droit (CAD)",
    description:
      "Pour un ouvrier de la construction, vérifier l'existence d'une CAD. Si oui, la sélectionner. Sinon, l'indemnité de remplacement (2 €) s'applique.",
  },
  {
    order: 6,
    when: "Calcul",
    title: "Calculer le code chiffré",
    description:
      "Déclencher le calcul du code chiffré sur la base du nouveau formulaire C32. Pour les dossiers d'admissibilité sur base d'un travail (42K30 / 42K33), valider la TIMELINE pour confirmer que les conditions sont réunies.",
  },
  {
    order: 7,
    when: "Allocations",
    title: "Finaliser la demande d'allocations",
    description:
      "Définir l'état de la demande (complet / incomplet), positionner la zone C2, et laisser le programme calculer automatiquement le code CAD ou l'indemnité IC selon le secteur.",
  },
  {
    order: 8,
    when: "Codification",
    title: "Valider la codification C2",
    description:
      "Vérifier la méthode de calcul (08 — pas concerné par la dégressivité) et le barème — affichés automatiquement.",
  },
] as const;

export const PROCEDURES: DossierProcedure[] = [
  {
    id: "introduction-tem",
    natureDA: "TEM",
    title: "Introduction TEM — Force majeure & accident technique",
    summary:
      "Suspension du contrat pour force majeure (évènement soudain et imprévisible), force majeure médicale (incapacité temporaire avec conflit mutuelle / médecin du travail) ou accident technique. Couvre ouvriers, employés et apprentis industriels.",
    audience: [...COMMON_AUDIENCE],
    internalRef: "FGTB/HELP/DEMM_TEM (rév. 06/12/2019)",
    lastReviewedAt: "2026-06-04",
    reglementation: [
      "AR du 25/11/1991 — art. 61, 106, 107, 108, 108bis, 109, 133",
    ],
    conditionsObligatoire: [
      "Première DA en chômage temporaire",
      "Chaque période de référence (01/10 → 30/09) si possibilité d'obtenir un code chiffré plus élevé",
      "Après une interruption d'allocations CT de 36 mois",
      "Changement d'employeur",
      "Changement de Q/S (préfixe 04 : uniquement si changement facteur S)",
      "Toute force majeure à caractère médical",
      "Dès le 1er jour de CT économique théoriquement indemnisable si l'admissibilité n'est pas encore prouvée",
    ],
    conditionsFacultative: [
      "Uniquement pour révision à la hausse du code chiffré en cours de période",
    ],
    delais: {
      obligatoire: "Mois en cours + 2 mois (fin du 2ᵉ mois qui suit la DA)",
      facultative: "Mois en cours + 36 mois (fin du 36ᵉ mois qui suit la DA)",
      exceptions: "Si le 1er jour de la DA est en grève : délai obligatoire étendu à 6 mois",
    },
    formulaires: [
      {
        code: "WECH 502",
        label: "C3.2 de demande à déclaration de l'employeur",
        purpose: "demande",
        officialRef: "WECH 502 (flux DRS)",
      },
      {
        code: "WECH 505",
        label: "C32 de paiement à déclaration de l'employeur",
        purpose: "paiement",
        officialRef: "WECH 505 (flux DRS)",
      },
      {
        code: "C3.2 travailleur",
        label: "Formulaire papier — obligatoire pour préfixe 02 + interruption 3/4, et pour préfixe 06",
        purpose: "support",
        officialRef: "C3.2 travailleur (papier)",
      },
      {
        code: "C3.2A",
        label: "Carte de contrôle chômage temporaire (FSE pour la construction)",
        purpose: "controle",
        officialRef: "C3.2A — tous secteurs hors construction / C3.2A FSE construction",
      },
    ],
    steps: [
      ...COMMON_STEPS_OBLIGATOIRE,
      {
        order: 100,
        when: "Force majeure médicale",
        title: "Joindre les pièces médicales",
        description:
          "Pour la FM médicale : fournir la décision du conseiller en prévention-médecin du travail (CPMT), l'avis du médecin traitant ou la preuve du recours contre la mutuelle. Vérifier l'inscription comme demandeur d'emploi dans les 8 jours suivant les 3 premiers mois.",
      },
      {
        order: 101,
        when: "Accident technique",
        title: "Vérifier la reconnaissance ONEM",
        description:
          "Pour un accident technique : la reconnaissance ONEM est obligatoire. L'indemnisation ne court qu'à partir du 8ᵉ jour de l'évènement. L'employeur doit communiquer le 1er jour effectif de chômage à l'ONEM (veille / jour / lendemain).",
      },
    ],
    codeReferences: [...COMMON_CODE_REFS, ...ADMISSIBILITY_REFS],
    notes:
      "Pas d'inscription comme demandeur d'emploi requise, SAUF force majeure et force majeure médicale (obligatoire dans les 8 jours suivant les 3 premiers mois). Construction (CP 124) : vérifier la carte d'ayant-droit (CAD) — droit à l'indemnité de 2 € sinon.",
  },

  {
    id: "introduction-gre",
    natureDA: "GRE",
    title: "Introduction GRE — Grève / lock-out",
    summary:
      "Suspension du contrat pendant une grève (initiée par les travailleurs) ou un lock-out (initié par l'employeur). Couvre ouvriers, employés et apprentis industriels. L'indemnisation est conditionnée à la décision du comité de gestion de l'ONEM.",
    audience: [...COMMON_AUDIENCE],
    internalRef: "FGTB/HELP/DEMM_GRE (rév. 02/12/2019)",
    lastReviewedAt: "2026-06-04",
    reglementation: [
      "AR du 25/11/1991 — art. 73, 106, 107, 108, 108bis, 109, 133",
    ],
    conditionsObligatoire: [
      "Première DA en chômage temporaire pendant la période de grève / lock-out",
      "Chaque période de référence (01/10 → 30/09) avec possibilité de code chiffré plus élevé",
      "Après interruption d'allocations CT de 36 mois",
      "Changement d'employeur",
      "Changement de Q/S (préfixe 04 : uniquement si changement facteur S)",
      "Force majeure à caractère médical concomitante",
      "Dès le 1er jour de CT économique théoriquement indemnisable si admissibilité non prouvée",
    ],
    conditionsFacultative: [
      "Uniquement pour révision à la hausse du code chiffré",
    ],
    delais: {
      obligatoire: "Mois en cours + 6 mois (délai étendu spécifique grève)",
      facultative: "Mois en cours + 36 mois",
    },
    formulaires: [
      {
        code: "WECH 502",
        label: "C3.2 de demande à déclaration de l'employeur",
        purpose: "demande",
        officialRef: "WECH 502",
      },
      {
        code: "WECH 505",
        label: "C32 de paiement à déclaration de l'employeur",
        purpose: "paiement",
        officialRef: "WECH 505",
      },
      {
        code: "C3.2 travailleur",
        label: "Formulaire papier (préfixe 02 + interruption 3/4, ou préfixe 06)",
        purpose: "support",
      },
      {
        code: "C3.2A",
        label: "Carte de contrôle (FSE pour la construction)",
        purpose: "controle",
      },
    ],
    steps: [
      ...COMMON_STEPS_OBLIGATOIRE,
      {
        order: 100,
        when: "Décision ONEM",
        title: "Tracer la décision du comité de gestion",
        description:
          "L'indemnisation dépend de la décision du comité de gestion ONEM, reflétée dans le programme de paiement par un flag : G (accord — indemnisable), N (pas d'accord) ou ? (en attente de réponse).",
      },
    ],
    codeReferences: [
      ...COMMON_CODE_REFS,
      ...ADMISSIBILITY_REFS,
      {
        tableSlug: "decisions-comite-gestion-gre",
        code: "G",
        label: "Accord — grève indemnisable",
      },
      {
        tableSlug: "decisions-comite-gestion-gre",
        code: "N",
        label: "Pas d'accord — grève non indemnisable",
      },
      {
        tableSlug: "decisions-comite-gestion-gre",
        code: "?",
        label: "En attente de la décision ONEM",
      },
    ],
    notes:
      "Pas d'inscription comme demandeur d'emploi. Conditions d'admissibilité au CT économique (codes 51 / 511) vérifiées à chaque DA, peu importe le motif. Construction (CP 124) : contrôle CAD identique à TEM.",
  },

  {
    id: "introduction-int",
    natureDA: "INT",
    title: "Introduction INT — Intempéries, économique & suspension employés",
    summary:
      "Trois sous-cas : chômage économique (ouvriers + apprentis industriels), intempéries (ouvriers + apprentis industriels) et suspension employés pour manque de travail. Obligations de notification / communication employeur distinctes selon le sous-cas.",
    audience: [...COMMON_AUDIENCE],
    internalRef: "FGTB/HELP/DEMM_INT (rév. 02/12/2019)",
    lastReviewedAt: "2026-06-04",
    reglementation: [
      "AR du 25/11/1991 — art. 106, 107, 108, 108bis, 109, 133",
    ],
    conditionsObligatoire: [
      "Première DA en chômage temporaire",
      "Chaque période de référence (01/10 → 30/09) avec possibilité de code chiffré plus élevé",
      "Après interruption d'allocations CT de 36 mois",
      "Changement d'employeur",
      "Changement de Q/S (préfixe 04 : uniquement si changement facteur S)",
      "Force majeure à caractère médical",
      "1er jour de CT économique théoriquement indemnisable si admissibilité non prouvée",
    ],
    conditionsFacultative: [
      "Uniquement pour révision à la hausse du code chiffré",
    ],
    delais: {
      obligatoire: "Mois en cours + 2 mois",
      facultative: "Mois en cours + 36 mois",
      exceptions: "Si 1er jour = grève : obligatoire étendu à 6 mois",
    },
    formulaires: [
      {
        code: "WECH 502",
        label: "C3.2 de demande à déclaration de l'employeur",
        purpose: "demande",
      },
      {
        code: "WECH 505",
        label: "C32 de paiement à déclaration de l'employeur",
        purpose: "paiement",
      },
      {
        code: "C3.2 travailleur",
        label: "Papier — pour préfixe 02 + interruption 3/4, ou préfixe 06",
        purpose: "support",
      },
      {
        code: "C3.2A",
        label: "Carte de contrôle (FSE pour la construction)",
        purpose: "controle",
      },
    ],
    steps: [
      ...COMMON_STEPS_OBLIGATOIRE,
      {
        order: 100,
        when: "Obligations employeur — économique",
        title: "Notification + communication 1er jour",
        description:
          "Économique : l'employeur notifie la période prévue, doit respecter une semaine de reprise entre deux notifications (sauf petite suspension), puis communique le 1er jour effectif à l'ONEM (le jour même, le lendemain ouvrable, ou dans les 5 jours ouvrables qui précèdent).",
      },
      {
        order: 101,
        when: "Obligations employeur — intempéries",
        title: "Pas de notification, communication 1er jour obligatoire",
        description:
          "Intempéries : aucune notification préalable, mais communication obligatoire à l'ONEM du 1er jour effectif dans le mois (le jour même, le lendemain ouvrable ou la veille ouvrable).",
      },
      {
        order: 102,
        when: "Obligations employeur — suspension employés",
        title: "Notification période + nature, communication 1er jour",
        description:
          "Suspension employés : notification de la période prévue et de la nature de l'interruption (complète / partielle), puis communication du 1er jour effectif à l'ONEM. Une seule communication suffit si plusieurs formes de CT coexistent dans le mois.",
      },
    ],
    codeReferences: [...COMMON_CODE_REFS, ...ADMISSIBILITY_REFS],
    notes:
      "Pas d'inscription comme demandeur d'emploi requise. Construction (CP 124) : contrôle CAD identique aux autres natures.",
  },

  {
    id: "introduction-ctp",
    natureDA: "CTP",
    title: "Introduction CTP — Travailleur ayant dépassé l'âge légal de la pension",
    summary:
      "Depuis le 01/01/2015, un travailleur qui continue au-delà de 65 ans peut bénéficier des allocations CT (sauf cumul avec la pension). À partir du mois suivant ses 65 ans et dès le premier mois en CT, une DA doit être introduite — principalement pour relancer l'intégration ONEM.",
    audience: [...COMMON_AUDIENCE],
    internalRef: "FGTB/HELP/DEMM_CTP (rév. 24/01/2020)",
    lastReviewedAt: "2026-06-04",
    reglementation: [
      "AR du 25/11/1991 — articles applicables au CT (61, 73, 106-109, 133)",
    ],
    conditionsObligatoire: [
      "Scénario 1 : CTP coïncidant avec une DA obligatoire (configuration fréquente)",
    ],
    conditionsFacultative: [
      "Scénario 2 : CTP avec révision à la hausse du code chiffré",
      "Scénario 3 : CTP uniquement pour relancer l'intégration ONEM (aucune révision)",
    ],
    delais: {
      obligatoire: "Mois en cours + 2 mois (fin du 2ᵉ mois qui suit la DA)",
      facultative: "Mois en cours + 36 mois (scénario 2) ; pas de délai sauf prescription (scénario 3)",
    },
    formulaires: [
      {
        code: "C1",
        label: "Composition familiale — impression depuis l'écran composition familiale",
        purpose: "support",
        officialRef: "C1",
      },
      {
        code: "WECH 502",
        label: "C3.2 de demande à déclaration de l'employeur",
        purpose: "demande",
      },
      {
        code: "WECH 505",
        label: "C32 de paiement à déclaration de l'employeur",
        purpose: "paiement",
      },
      {
        code: "C32 travailleur",
        label: "Papier — scénarios 1 et 3 si pas de WECH",
        purpose: "support",
      },
      {
        code: "C109",
        label: "Alternative au WECH dans le scénario 3 (intégration seule)",
        purpose: "support",
      },
    ],
    steps: [
      {
        order: 1,
        when: "Création",
        title: "Initialiser la CTP",
        description:
          "Date de demande = 1er du mois suivant les 65 ans du travailleur. Nature = CTP. Préfixe limité à 02 ou 04 à partir de 65 ans (les préfixes 05, 06, 57, 58 ne sont plus possibles).",
      },
      {
        order: 2,
        when: "Intégration",
        title: "Mettre à jour la signalétique membre & relancer l'intégration",
        description:
          "Vérifier les informations signalétiques, valider l'intégration. L'intégration habituelle se termine au plus tard le dernier jour du mois des 65 ans. La nouvelle intégration court alors jusqu'au dernier jour du mois où la personne atteint 99 ans (code 15).",
      },
      {
        order: 3,
        when: "Scénario 1 (DA obligatoire)",
        title: "Suivre la procédure INT/TEM obligatoire complète",
        description:
          "Workflow identique à une DA obligatoire INT (paramètres + analyse CT + documents externes + import occupation + calcul code chiffré + allocations + codification), avec en plus l'impression de la C1 depuis la composition familiale.",
      },
      {
        order: 4,
        when: "Scénario 2 (révision)",
        title: "Suivre la procédure INT/TEM facultative",
        description:
          "Workflow identique à une DA facultative INT/TEM (recopie de l'article d'admissibilité, clôture période, import occupation, recalcul code chiffré, allocations), plus impression C1.",
      },
      {
        order: 5,
        when: "Scénario 3 (intégration seule)",
        title: "Re-vérifier l'admissibilité historique et finaliser",
        description:
          "Vérifier l'article d'admissibilité valable lors de la dernière DA CT. Recopier l'article 042 + l'admissibilité dans les paramètres. Réclamer le C3.2 EL et les flux complémentaires. Imprimer la C1. Importer l'occupation. État de demande = 1, C2 = Y. Rappel de la dernière codification valable.",
      },
      {
        order: 6,
        when: "Codification",
        title: "Valider la codification C2",
        description:
          "Méthode de calcul 08 (pas de dégressivité) et barème ligne unique affichés automatiquement.",
      },
    ],
    codeReferences: [
      {
        tableSlug: "s04-s36-prefixe-type-chomage",
        code: "02",
        label: "Préfixe 02 — temps plein (seul autorisé à partir de 65 ans avec 04)",
      },
      {
        tableSlug: "s04-s36-prefixe-type-chomage",
        code: "04",
        label: "Préfixe 04 — temps partiel volontaire / crédit-temps",
      },
      ...ADMISSIBILITY_REFS,
    ],
    notes:
      "Exception : la force majeure médicale reste accessible au-delà de 65 ans. Les allocations CT ne sont pas cumulables avec la pension. Si le travailleur conteste une décision du médecin-conseil de la mutuelle, la DA reste introduite normalement avec les pièces justificatives.",
  },
];
