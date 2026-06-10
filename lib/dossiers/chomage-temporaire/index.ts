// Dossier "Chômage temporaire" — module autonome.
//
// Décrit ses 11 motifs officiels (nomenclature ONEM), ses questions
// d'orientation, ses documents (avec leur logique d'inclusion conditionnelle)
// et son espace théorique. Les champs référencent le catalogue partagé.
// Aucun lien avec les autres dossiers.

import type {
  DossierDefinition,
  DossierTheorySection,
  NatureDAResolver,
  WhoConcernedMatrix,
} from "../types";
import { PROCEDURES } from "./procedures";

/// Les 11 motifs officiels de chômage temporaire (nomenclature ONEM).
/// Le code numérique + la lettre figurent en commentaire pour traçabilité.
export const MOTIFS = [
  "Économique",                        // 5.1 / E
  "Intempéries",                       // 5.2 / I
  "Accident technique",                // 5.3 / T
  "Force majeure",                     // 5.4 / F
  "Force majeure médicale",            // 5.5 / FM
  "Vacances annuelles",                // 5.6 / V (fermeture collective)
  "Vacances complémentaires",          // ex. VACANTEX dans le textile
  "Repos compensatoire",               // jours RC groupés
  "Grève ou lock-out",
  "Travailleur protégé",               // délégués syndicaux
  "Suspension employés",               // entreprise en difficulté
] as const;

export type Motif = (typeof MOTIFS)[number];

/// Identifiant slug d'un motif (pour usage dans les conditions / matrices).
const MOTIF_IDS = {
  economique: "Économique",
  intemperies: "Intempéries",
  accidentTechnique: "Accident technique",
  forceMajeure: "Force majeure",
  forceMajeureMedicale: "Force majeure médicale",
  vacancesAnnuelles: "Vacances annuelles",
  vacancesComplementaires: "Vacances complémentaires",
  reposCompensatoire: "Repos compensatoire",
  greve: "Grève ou lock-out",
  travailleurProtege: "Travailleur protégé",
  suspensionEmployes: "Suspension employés",
} as const;

/// Matrice "qui peut bénéficier de tel motif" — sert à filtrer les options
/// de motif selon le statut (ouvrier / employé / intérimaire) du répondant.
export const WHO_CONCERNED: WhoConcernedMatrix = {
  [MOTIF_IDS.economique]:             ["ouvrier", "interimaire"], // pas employé : voir Suspension employés
  [MOTIF_IDS.intemperies]:            ["ouvrier"],
  [MOTIF_IDS.accidentTechnique]:      ["ouvrier"],
  [MOTIF_IDS.forceMajeure]:           ["ouvrier", "employe", "interimaire"],
  [MOTIF_IDS.forceMajeureMedicale]:   ["ouvrier", "employe"],
  [MOTIF_IDS.vacancesAnnuelles]:      ["ouvrier", "employe", "interimaire"],
  [MOTIF_IDS.vacancesComplementaires]:["ouvrier", "employe", "interimaire"],
  [MOTIF_IDS.reposCompensatoire]:     ["ouvrier", "employe", "interimaire"],
  [MOTIF_IDS.greve]:                  ["ouvrier", "employe", "interimaire"],
  [MOTIF_IDS.travailleurProtege]:     ["ouvrier", "employe"],
  [MOTIF_IDS.suspensionEmployes]:     ["employe"],
};

/// Calcule la nature de DA (code ONEM) à partir des réponses d'orientation.
/// Règle approximative dérivée des règles ONEM connues — à raffiner avec
/// l'évolution des questions d'orientation.
export const natureDA: NatureDAResolver = (a) => {
  const motif = typeof a.motif === "string" ? a.motif : "";
  // Le statut (ouvrier/employé/intérimaire) n'affecte pas le code de nature
  // DA dans les règles actuelles. Il pourra être consommé si on ajoute des
  // règles plus fines plus tard.
  const premiere = a.premiereDemande === true;
  const transfert = a.transfertEnCours === true;
  const senior = a.age66Plus === true;

  // Situations indépendantes du motif (prioritaires).
  if (transfert) return { code: "TFT", label: "Transfert en cours de chômage temporaire" };
  if (senior) return { code: "CTP", label: "1er jour de chômage temporaire à 66 ans ou plus" };
  if (premiere) return { code: "TPL", label: "Première demande (jamais eu de dossier chômage)" };

  // Catégorisation par motif (cas de DA récurrentes).
  if (
    motif === MOTIF_IDS.economique ||
    motif === MOTIF_IDS.suspensionEmployes ||
    motif === MOTIF_IDS.intemperies
  ) return { code: "INT", label: "Intempéries / Économique ouvrier / Suspension employés" };

  if (
    motif === MOTIF_IDS.accidentTechnique ||
    motif === MOTIF_IDS.forceMajeure ||
    motif === MOTIF_IDS.forceMajeureMedicale ||
    motif === MOTIF_IDS.travailleurProtege
  ) return { code: "TEM", label: "Force majeure / Accident technique / Travailleur protégé" };

  if (
    motif === MOTIF_IDS.vacancesAnnuelles ||
    motif === MOTIF_IDS.vacancesComplementaires
  ) return { code: "VAC", label: "Vacances annuelles ou complémentaires" };

  return null;
};

/// Sections de l'espace théorique. Paraphrasées en interne, jamais de citation
/// verbatim d'une source non publique. Les bindings `{{ … }}` sont interpolés
/// au rendu depuis la structure du dossier.
const THEORY: DossierTheorySection[] = [
  {
    id: "introduction",
    title: "Introduction",
    body: `
Le chômage temporaire (CT) est une suspension provisoire totale ou partielle
du contrat de travail, pendant laquelle le travailleur peut percevoir des
allocations versées par l'ONEM via son organisme de paiement.

À la différence du chômage complet, le contrat de travail n'est pas rompu —
l'occupation reprend dès que la cause de la suspension a disparu.

Onze motifs officiels existent, chacun avec ses conditions propres,
ses formalités employeur et ses documents.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-02",
  },
  {
    id: "motifs",
    title: "Les onze motifs",
    body: `
Les motifs reconnus de chômage temporaire sont :

{{ motifs }}

Chaque motif obéit à des règles d'admissibilité distinctes et n'est ouvert
qu'à certaines catégories de travailleurs (ouvrier, employé, intérimaire).
    `.trim(),
    audience: ["admin", "partner"],
    bindings: ["motifs"],
    lastReviewedAt: "2026-06-02",
  },
  {
    id: "qui-est-concerne",
    title: "Qui peut bénéficier de quel motif",
    body: `
Les motifs ne sont pas tous ouverts à tous les statuts. La matrice ci-dessous
récapitule les ouvertures.

{{ qui-est-concerne }}

Quelques cas particuliers :

- **Économique** : l'employé classique n'y a pas accès — il bascule vers la
  *Suspension employés*, qui suppose que l'entreprise prouve à l'ONEM qu'elle
  remplit les conditions (entreprise en difficulté).
- **Force majeure médicale** : ne concerne pas les intérimaires.
- **Travailleur protégé** : réservé aux délégués syndicaux (ouvrier ou employé).
- **Suspension employés** : exclusivement employé.

Pour les intérimaires en chômage temporaire économique, la situation reste
strictement encadrée (ancienneté requise, procédure CT en cours pour les
travailleurs fixes du même département, etc.).
    `.trim(),
    audience: ["admin", "partner"],
    bindings: ["qui-est-concerne"],
    lastReviewedAt: "2026-06-02",
  },
  {
    id: "conditions",
    title: "Conditions d'admissibilité et d'octroi",
    body: `
Deux niveaux de conditions s'appliquent :

1. **Admissibilité** — le travailleur doit avoir, sur une période de référence
   précédant la demande, suffisamment de journées de travail prouvées. Les
   exigences varient selon l'âge et la nature du contrat.
2. **Octroi** — il faut, au moment où l'allocation est versée, satisfaire
   plusieurs conditions personnelles : disponibilité pour le marché du travail,
   absence d'autre revenu de remplacement, absence de sanction, etc.

Une sanction ou une exclusion active à un autre titre (chômage complet, par
exemple) peut impacter directement l'indemnisation du chômage temporaire.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-02",
  },
  {
    id: "documents",
    title: "Documents à constituer",
    body: `
Les documents que **le travailleur** dépose dans le cadre d'une demande de
chômage temporaire :

{{ documents }}

En parallèle, l'**employeur** transmet à l'ONEM, par voie électronique, sa
propre déclaration (DRS / WECH) ainsi que les notifications et communications
selon le motif. Ces flux ne transitent pas par le présent dossier — ils sont
filés directement par l'employeur via les portails ONSS/ONEM.

Le C32 travailleur est le pivot du dossier dans la quasi-totalité des cas. Il
peut être remplacé par d'autres formulaires (C6) dans certaines situations
particulières comme la force majeure médicale.
    `.trim(),
    audience: ["admin", "partner"],
    bindings: ["documents"],
    lastReviewedAt: "2026-06-02",
  },
  {
    id: "nature-da",
    title: "Nature de la demande d'allocation (DA)",
    body: `
La « nature de DA » est un code ONEM qui résume le contexte de la demande
(transfert en cours, première demande jamais perçue, 66 ans et plus, type
de chômage temporaire applicable, etc.).

Elle se déduit des réponses aux questions d'orientation et de la situation
personnelle du demandeur — ce n'est pas une question que l'on pose à
l'utilisateur, mais une **valeur calculée**.

Les principales natures rencontrées en CT :

- **TPL / TPV** — première demande (jamais eu de dossier chômage)
- **TFT** — transfert en cours de CT
- **CTP** — 1er jour de CT à 66 ans ou plus
- **INT** — économique ouvrier, suspension employés, intempéries
- **TEM** — accident technique, force majeure, force majeure médicale, travailleur protégé
- **VAC** — vacances annuelles ou complémentaires
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-02",
  },
  {
    id: "delais",
    title: "Délais d'introduction",
    body: `
Le délai d'introduction d'une demande dépend du type de demande et du motif :

| Type de DA | Délai standard | Exceptions notables |
| --- | --- | --- |
| Obligatoire | mois en cours + 2 mois | Changement Q/S : + 36 mois · Grève : + 6 mois · 66+ : aucun délai |
| Facultative | mois en cours + 36 mois | — |

Les outils internes (AS400) n'appliquent pas toujours les exceptions
automatiquement et retombent sur le délai standard le plus court — d'où
l'importance, pour le partenaire, de connaître la règle exacte du motif.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-02",
  },
  {
    id: "demarches-employeur",
    title: "Démarches employeur — vue d'ensemble",
    body: `
Côté employeur, les obligations dépendent du motif :

- **Notification** (procédure préalable) : exigée pour économique, accident
  technique et suspension employés. Elle s'effectue par voie électronique
  avant le début de la période de chômage temporaire.
- **Communication du 1er jour effectif** : à transmettre chaque mois pour
  économique, intempéries, accident technique et suspension employés.
- **DRS / WECH** : déclaration sociale électronique transmise par
  l'employeur via le portail ONSS. Un seul concept, deux appellations :
  *DRS* est le nom public côté affilié (Déclaration de Risque Social),
  *WECH* est l'argot interne (ex. WECH 502 pour la déclaration
  d'occurrence, WECH 505 pour le flux qui sert au paiement). Pour
  l'affilié, ces flux ne sont pas perceptibles : il en voit le résultat
  (allocations versées).

Aucune des formalités employeur ne fait partie des PDFs que le travailleur
remplit dans le dossier ; on les rappelle ici pour information.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-02",
  },
];

export const chomageTemporaire: DossierDefinition = {
  slug: "chomage-temporaire",
  title: "Chômage temporaire",
  description:
    "Aide à constituer le dossier de chômage temporaire (économique, intempéries, force majeure, etc.) à remettre à l'ONEM.",
  category: "emploi",
  icon: "💼",
  color: "#FF8C42",
  vocabularyTags: [
    "chômage",
    "chomage temporaire",
    "ONEM",
    "RVA",
    "force majeure",
    "intempéries",
    "économique",
    "fermeture temporaire",
    "suspension employés",
    "travailleur protégé",
  ],
  types: [...MOTIFS],
  whoConcerned: WHO_CONCERNED,
  natureDA,

  questions: [
    // ------- Statut & contexte -------
    {
      id: "statut",
      label: { fr: "Quel est ton statut ?" },
      type: "select",
      options: [
        { value: "ouvrier", label: { fr: "Ouvrier" } },
        { value: "employe", label: { fr: "Employé" } },
        { value: "interimaire", label: { fr: "Intérimaire ou apprenti industriel" } },
      ],
    },
    {
      id: "commissionParitaire",
      label: { fr: "Travailles-tu dans le secteur de la construction (CP 124) ?" },
      type: "select",
      options: [
        { value: "construction", label: { fr: "Oui — Construction (CP 124)" } },
        { value: "autre", label: { fr: "Non — autre commission paritaire" } },
        { value: "inconnu", label: { fr: "Je ne sais pas" } },
      ],
    },
    {
      id: "typeChomage",
      label: { fr: "Quel est ton régime de travail ?" },
      type: "select",
      options: [
        { value: "temps-plein", label: { fr: "Temps plein" } },
        { value: "tp-mdd", label: { fr: "Temps partiel avec maintien des droits (sans AGR)" } },
        { value: "tp-volontaire", label: { fr: "Temps partiel volontaire / crédit-temps" } },
        { value: "tp-agr", label: { fr: "Temps partiel avec maintien des droits + AGR" } },
      ],
    },

    // ------- Motif -------
    {
      id: "motif",
      label: { fr: "Quel est le motif du chômage temporaire ?" },
      type: "select",
      options: MOTIFS.map((m) => ({ value: m, label: { fr: m } })),
    },

    // ------- Sous-questions selon motif (toujours visibles, à remplir si pertinent) -------
    {
      id: "decisionComiteGestionGreve",
      label: { fr: "Si grève : as-tu déjà reçu la décision du comité de gestion ONEM ?" },
      type: "select",
      options: [
        { value: "accord", label: { fr: "Oui — accord (grève indemnisable)" } },
        { value: "refus", label: { fr: "Oui — refus (grève non indemnisable)" } },
        { value: "attente", label: { fr: "Non — en attente de la décision" } },
        { value: "na", label: { fr: "Sans objet (pas de grève)" } },
      ],
    },
    {
      id: "trajetReintegration",
      label: { fr: "Si force majeure médicale : suis-tu un trajet de réintégration ?" },
      type: "boolean",
      visibleWhen: (a) => a.motif === MOTIF_IDS.forceMajeureMedicale,
    },
    {
      id: "formationAlternancePendantCT",
      label: { fr: "Suis-tu une formation en alternance pendant ce chômage temporaire ?" },
      type: "boolean",
    },

    // ------- Historique -------
    {
      id: "premiereDemande",
      label: { fr: "Est-ce ta première demande de chômage temporaire ?" },
      type: "boolean",
    },
    {
      id: "modificationC1",
      label: { fr: "Tes données personnelles ont-elles changé depuis ton dernier C1 ?" },
      type: "boolean",
      visibleWhen: (a) => a.premiereDemande !== true,
    },
    {
      id: "changementEmployeur",
      label: { fr: "As-tu changé d'employeur depuis ta dernière demande ?" },
      type: "boolean",
    },
    {
      id: "interruptionCT36Mois",
      label: { fr: "Tes allocations de chômage temporaire ont-elles été interrompues plus de 36 mois ?" },
      type: "boolean",
    },

    // ------- Particularités -------
    {
      id: "age66Plus",
      label: { fr: "As-tu 66 ans ou plus ?" },
      type: "boolean",
    },
    {
      id: "transfertEnCours",
      label: { fr: "S'agit-il d'un transfert en cours de chômage temporaire ?" },
      type: "boolean",
    },
    {
      id: "incapacite33Pourcent",
      label: { fr: "Présentes-tu une incapacité de travail permanente d'au moins 33 % ?" },
      type: "boolean",
    },
  ],

  warnings: [
    {
      title: "Délai d'introduction",
      message:
        "Le délai d'introduction varie selon le type de demande : généralement mois en cours + 2 mois (obligatoire) ou + 36 mois (facultative). Certaines situations (changement Q/S, grève, 66+ ans) bénéficient d'exceptions.",
      severity: "warning",
    },
    {
      title: "Accident technique — particularité",
      message:
        "Pour un chômage temporaire pour accident technique, l'allocation n'est versée qu'à partir du 8ᵉ jour calendrier. Les 7 premiers jours restent à charge de l'employeur.",
      severity: "info",
      visibleWhen: (a) => a.motif === MOTIF_IDS.accidentTechnique,
    },
  ],

  documents: [
    {
      // C3.2 Travailleur — pivot du dossier (sauf force majeure médicale).
      slug: "c32-travailleur",
      title: "C3.2 — Travailleur",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C32_Travailleur_FR.pdf",
      internalRef: "Doc formation, section Documents de demande",
      includeWhen: (a) => a.motif !== MOTIF_IDS.forceMajeureMedicale,
      fields: [
        // Identité.
        { field: "fullName", required: true, section: "identite", pdfFieldName: "Nom Prénom du travailleur" },
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
        // Statut sur le PDF : widget radio "Group2" (Travailleur / Apprenti).
        {
          custom: {
            key: "statutSurPdf",
            pdfFieldName: "Group2",
            type: "select",
            label: { fr: "Statut sur le formulaire" },
          },
          required: true,
          section: "identite",
        },
        // Déclaration.
        {
          custom: {
            key: "dateDemande",
            pdfFieldName: "date de DA",
            type: "date",
            label: { fr: "Date de la demande d'allocation" },
          },
          required: true,
          section: "declaration",
        },
        // creationDate ("Aujourd'hui") + signature → masqués, injectés à la
        // génération du PDF.
        { field: "creationDate", pdfFieldName: "Aujourd'hui" },
        { field: "signature", pdfFieldName: "Signature" },
      ],
    },
    {
      // C1 — Demande d'allocations (travailleur).
      // Requis si : modification C1, OU dernier jour indemnisé ≥ 1 an
      // (équivalent à une "première demande" dans la pratique), OU 1er jour
      // de CT à 66 ans+.
      slug: "c1-travailleur",
      title: "C1 — Demande d'allocations",
      issuer: "ONEM",
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef: "Doc formation, section Documents de demande, item C1",
      includeWhen: (a) =>
        a.premiereDemande === true ||
        a.modificationC1 === true ||
        a.age66Plus === true,
      fields: [
        // Mapping ciblé — les ~140 autres widgets restent en inférence par
        // défaut tant qu'on n'a pas affiné.
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
    {
      // C6 — pour Force majeure médicale (remplace le C32 travailleur).
      slug: "c6-fmm",
      title: "C6 — Force majeure médicale",
      issuer: "ONEM",
      sourcePdfPath: "private/pdfs/C6_FR.pdf",
      internalRef: "Doc formation, section Documents supplémentaires FMM",
      includeWhen: (a) => a.motif === MOTIF_IDS.forceMajeureMedicale,
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
    {
      // C27R — pour Force majeure médicale avec trajet de réintégration.
      slug: "c27r-fmm",
      title: "C27R — Trajet de réintégration",
      issuer: "ONEM",
      sourcePdfPath: "private/pdfs/C27_R_FR.pdf",
      internalRef: "Doc formation, section FMM avec trajet de réintégration",
      includeWhen: (a) =>
        a.motif === MOTIF_IDS.forceMajeureMedicale && a.trajetReintegration === true,
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
  ],

  theory: THEORY,
  procedures: PROCEDURES,
};
