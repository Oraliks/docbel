// Dossier "Chômage complet" — module autonome (skeleton fonctionnel).
//
// Le chômage complet concerne les personnes dont le contrat de travail a été
// rompu (licenciement, démission, fin de CDD, etc.) ou qui sollicitent pour
// la première fois une indemnisation de chômage. À la différence du chômage
// temporaire, il n'y a pas de motif officiel à choisir : la demande est
// binaire (admissibilité oui/non) et conditionnée par l'historique de
// travail, la situation familiale et l'inscription auprès du service régional
// de l'emploi (FOREM / ACTIRIS / VDAB / ADG).
//
// Ce module est un SQUELETTE : il met en place le questionnaire d'orientation
// et le C1 (déclaration personnelle commune à toutes les demandes de
// chômage). Les autres pièces officielles (C4, C61, C109) ne sont pas encore
// disponibles en PDF — elles sont documentées en TODO ci-dessous.
//
// Sources publiques de référence (paraphrasées, jamais citées verbatim) :
// www.onem.be — chômage complet ; sites des services régionaux de l'emploi.

import type { DossierDefinition, DossierTheorySection } from "../types";

// -------------------------------------------------------------------
// TODOs documents — à seeder quand les PDFs officiels seront disponibles.
// -------------------------------------------------------------------
//   - C4 (« Certificat de chômage ») : remis par l'employeur en fin de
//     contrat. Pivot du dossier car il atteste les périodes de travail
//     et le motif de fin de contrat. Slug provisoire : "c4-employeur".
//   - C61 (« Carte de contrôle ») : remplie chaque mois par le chômeur
//     pour déclarer ses activités, absences et reprises de travail.
//     Slug provisoire : "c61-carte-controle".
//   - C109 (« Déclaration de la situation familiale ») : nécessaire pour
//     déterminer la catégorie (isolé, chef de ménage, cohabitant) et
//     ainsi le montant des allocations. Slug provisoire : "c109-situation-familiale".
// -------------------------------------------------------------------

/// Sections de l'espace théorique. Paraphrases internes — pas de copie de
/// source non publique. Audience : admin + partenaires uniquement à ce stade.
const THEORY: DossierTheorySection[] = [
  {
    id: "qui-peut-beneficier",
    title: "Qui peut bénéficier ?",
    body: `
Le chômage complet est ouvert au travailleur dont le contrat de travail a
pris fin (licenciement, démission, fin de CDD, rupture amiable…) et qui
remplit plusieurs conditions de base :

- avoir travaillé un nombre suffisant de jours pendant la période de
  référence précédant la demande (le seuil augmente avec l'âge) ;
- être inscrit comme demandeur d'emploi auprès du service régional
  (FOREM en Wallonie, ACTIRIS à Bruxelles, VDAB en Flandre, ADG dans la
  Communauté germanophone) ;
- être disponible pour le marché du travail (apte, prêt à accepter un
  emploi convenable, à suivre une formation, etc.) ;
- ne pas être déjà couvert par un autre revenu de remplacement
  (mutuelle, pension, rémunération à temps plein…).

Les indépendants qui ont cotisé volontairement au régime du chômage
salarié et les jeunes en première inscription (stage d'insertion
professionnelle) suivent des règles spécifiques.

Source publique de référence : www.onem.be.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "delai-8-jours",
    title: "Le délai de 8 jours",
    body: `
L'introduction de la demande doit intervenir rapidement après la fin du
contrat de travail. En pratique, on retient un repère simple : **8 jours
ouvrables** à partir du jour qui suit la fin du contrat pour s'inscrire
comme demandeur d'emploi auprès du service régional et déposer le
dossier auprès de l'organisme de paiement (FGTB, CSC, CGSLB ou CAPAC).

Un dépôt tardif n'éteint pas le droit, mais peut entraîner une perte
des allocations pour la période couverte par le retard. En cas de
difficulté (maladie, démarches en cours), le partenaire doit pouvoir
documenter la cause du retard pour la faire valoir auprès de l'ONEM.

Source publique de référence : www.onem.be.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "documents-a-preparer",
    title: "Les documents à préparer",
    body: `
Les documents que le travailleur prépare dans le cadre d'une demande de
chômage complet :

{{ documents }}

D'autres pièces officielles sont normalement requises mais ne sont pas
encore intégrées à Beldoc — elles devront être ajoutées dans une étape
ultérieure :

- **C4** — Certificat de chômage remis par l'employeur en fin de
  contrat. Il atteste la durée des prestations et le motif de la rupture.
- **C61** — Carte de contrôle, à compléter mensuellement par le chômeur
  pour déclarer ses activités et absences.
- **C109** — Déclaration de la situation familiale, qui détermine la
  catégorie (isolé / chef de ménage / cohabitant) et donc le montant
  des allocations.

Pour les premières inscriptions au chômage (jeunes après leurs études),
le service régional de l'emploi délivre une attestation d'inscription
qui ouvre le stage d'insertion professionnelle.

Source publique de référence : www.onem.be.
    `.trim(),
    audience: ["admin", "partner"],
    bindings: ["documents"],
    lastReviewedAt: "2026-06-10",
  },
];

export const chomageComplet: DossierDefinition = {
  slug: "chomage-complet",
  title: "Chômage complet",
  description:
    "Aide à constituer le dossier de chômage complet après une perte d'emploi (licenciement, démission, fin de CDD) ou pour une première inscription.",
  category: "emploi",
  icon: "💼",
  color: "#DC2626",
  vocabularyTags: [
    "chômage",
    "perte d'emploi",
    "licenciement",
    "demande allocations",
    "C1",
    "C4",
  ],

  // Le chômage complet ne se décline pas en "motifs" comme le chômage
  // temporaire : c'est une décision binaire (admissible ou non). Le motif de
  // fin de contrat est consigné dans le questionnaire, pas dans `types`.
  types: [],

  questions: [
    // ------- Statut & contexte -------
    {
      id: "statut",
      label: { fr: "Tu fais ta demande comme…" },
      helpText: {
        fr: "Salarié = tu avais un patron et tu travaillais pour lui contre un salaire. Indépendant qui cotise volontairement = tu travaillais à ton compte et tu as choisi de payer des cotisations pour avoir droit au chômage. Première inscription = tu sors juste de l'école et tu n'as encore jamais reçu de chômage.",
      },
      type: "select",
      options: [
        { value: "salarie", label: { fr: "Salarié (j'avais un patron)" } },
        {
          value: "independant-cotisant-volontaire",
          label: { fr: "Indépendant ayant cotisé volontairement au chômage" },
        },
        {
          value: "premiere-inscription",
          label: { fr: "Première inscription (je sors des études)" },
        },
      ],
    },

    // ------- Motif de la perte d'emploi -------
    {
      id: "motifPerteEmploi",
      label: { fr: "Pourquoi ton contrat de travail s'est-il terminé ?" },
      helpText: {
        fr: "Licenciement = ton patron t'a annoncé la fin de ton contrat. Démission = c'est toi qui as donné ton préavis. Fin de CDD = ton contrat avait une date de fin et elle est arrivée. Rupture amiable = vous avez décidé d'un commun accord d'arrêter. Chômage économique prolongé = ton patron t'avait déjà mis au chômage temporaire et la situation dure trop longtemps.",
      },
      type: "select",
      options: [
        { value: "licenciement", label: { fr: "Licenciement (mon patron a mis fin au contrat)" } },
        { value: "demission", label: { fr: "Démission (j'ai donné mon préavis)" } },
        { value: "fin-cdd", label: { fr: "Fin de contrat à durée déterminée (CDD)" } },
        { value: "rupture-amiable", label: { fr: "Rupture d'un commun accord" } },
        {
          value: "chomage-economique-prolonge",
          label: { fr: "Chômage économique prolongé qui se transforme en chômage complet" },
        },
        { value: "autre", label: { fr: "Autre situation" } },
      ],
      // Non pertinent pour une première inscription : il n'y a pas eu de
      // contrat à rompre.
      visibleIf: { fieldId: "statut", op: "notEquals", value: "premiere-inscription" },
    },

    // ------- Date de fin de contrat (pour le délai de 8 jours) -------
    {
      id: "dateFinContrat",
      label: { fr: "Quelle est la date de fin de ton contrat ?" },
      helpText: {
        fr: "C'est le dernier jour où tu étais encore employé. À partir du lendemain, tu as 8 jours ouvrables pour t'inscrire au chômage. Si tu ne te souviens pas exactement, regarde ton C4 ou le dernier document remis par ton employeur.",
      },
      type: "select",
      // Pas de type "date" disponible dans DossierQuestion → on utilise un
      // select grossier pour le squelette. À remplacer par un vrai champ
      // date quand le type sera ajouté au runner.
      options: [
        { value: "moins-8-jours", label: { fr: "Il y a moins de 8 jours ouvrables" } },
        { value: "8-a-30-jours", label: { fr: "Entre 8 et 30 jours" } },
        { value: "plus-30-jours", label: { fr: "Plus de 30 jours" } },
      ],
      visibleIf: { fieldId: "statut", op: "notEquals", value: "premiere-inscription" },
    },

    // ------- Historique -------
    {
      id: "aDejaTouche",
      label: { fr: "As-tu déjà reçu des allocations de chômage avant ?" },
      helpText: {
        fr: "Réponds « oui » si tu as déjà touché du chômage (complet ou temporaire) à un moment dans ta vie, même il y a longtemps. Sinon réponds « non » — c'est la première fois que tu fais une demande.",
      },
      type: "boolean",
    },

    // ------- Situation familiale -------
    {
      id: "chargeFamille",
      label: { fr: "Quelle est ta situation familiale ?" },
      helpText: {
        fr: "Isolé = tu vis seul. Chef de ménage = tu vis avec ta famille et tu es la seule personne du ménage qui ramène un revenu. Cohabitant = tu vis avec d'autres personnes qui ont aussi un revenu. Cohabitant avec charge = tu vis avec quelqu'un mais tu paies une pension alimentaire pour un enfant ou un ex-partenaire.",
      },
      type: "select",
      options: [
        { value: "isole", label: { fr: "Isolé (je vis seul)" } },
        { value: "chef-menage", label: { fr: "Chef de ménage (seul revenu du foyer)" } },
        { value: "cohabitant", label: { fr: "Cohabitant (je vis avec d'autres revenus)" } },
        {
          value: "cohabitant-charge",
          label: { fr: "Cohabitant avec charge (pension alimentaire à payer)" },
        },
      ],
    },

    // ------- Tranche d'âge -------
    {
      id: "agePersonne",
      label: { fr: "Quel est ton âge ?" },
      helpText: {
        fr: "L'âge change le nombre de jours de travail que tu dois prouver pour avoir droit au chômage : moins on est âgé, moins on doit en prouver.",
      },
      type: "select",
      options: [
        { value: "moins-30", label: { fr: "Moins de 30 ans" } },
        { value: "30-49", label: { fr: "Entre 30 et 49 ans" } },
        { value: "50-plus", label: { fr: "50 ans ou plus" } },
      ],
    },

    // ------- Inscription service régional emploi -------
    {
      id: "inscritServiceEmploi",
      label: { fr: "Es-tu déjà inscrit comme demandeur d'emploi ?" },
      helpText: {
        fr: "Pour avoir droit au chômage, tu dois être inscrit dans le service de l'emploi de ta région : FOREM en Wallonie, ACTIRIS à Bruxelles, VDAB en Flandre, ADG en Communauté germanophone. Si tu ne sais plus, réponds « non » — on te rappellera comment faire.",
      },
      type: "boolean",
    },

    // ------- Secteur (impact sur certains documents complémentaires) -------
    {
      id: "commissionParitaire",
      label: { fr: "Tu travaillais dans le secteur du bâtiment / construction ?" },
      helpText: {
        fr: "On parle ici de la « Commission paritaire 124 », c'est-à-dire les ouvriers du bâtiment (maçons, peintres, électriciens sur chantier, etc.). Si tu ne sais pas, choisis « Je ne sais pas » — on adaptera.",
      },
      type: "select",
      options: [
        { value: "construction", label: { fr: "Oui — bâtiment / construction" } },
        { value: "autre", label: { fr: "Non — un autre secteur" } },
        { value: "inconnu", label: { fr: "Je ne sais pas" } },
      ],
      visibleIf: { fieldId: "statut", op: "notEquals", value: "premiere-inscription" },
    },
  ],

  warnings: [
    {
      title: "Délai d'inscription : 8 jours",
      message:
        "Inscris-toi auprès du service régional de l'emploi (FOREM / ACTIRIS / VDAB / ADG) dans les 8 jours ouvrables qui suivent la fin de ton contrat. Un dépôt tardif peut entraîner la perte des allocations pour la période couverte par le retard.",
      severity: "warning",
    },
    {
      title: "Documents employeur à demander",
      message:
        "Le C4 (certificat de chômage) doit t'être remis par ton employeur dès la fin du contrat. S'il tarde, réclame-le par écrit : sans C4, ton organisme de paiement ne peut pas constituer ton dossier.",
      severity: "info",
    },
  ],

  documents: [
    {
      // C1 — Demande d'allocations (déclaration personnelle).
      // Commun à toutes les demandes de chômage. Pivot du dossier ici tant
      // que C4/C61/C109 ne sont pas encore disponibles côté PDF.
      // NB : slug distinct du C1 utilisé dans chomage-temporaire pour éviter
      // un conflit dans la table PdfForm (slug unique global).
      slug: "c1-chomage-complet",
      title: "C1 — Demande d'allocations",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef: "Dossier chomage-complet, document central (déclaration personnelle).",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
    {
      // C4 — Certificat de chômage. OBLIGATOIRE au dossier mais c'est
      // l'EMPLOYEUR qui doit le délivrer : le citoyen ne le remplit pas
      // lui-même dans beldoc. On le liste quand même (required) pour que la
      // personne sache qu'il doit figurer au dossier et le réclamer.
      // Pas de sourcePdfPath / fields : non remplissable côté citoyen.
      slug: "c4-employeur",
      title: "C4 — Certificat de chômage (à fournir par l'employeur)",
      issuer: "Employeur",
      required: true,
      responsibility: "employer",
      responsibilityNote: {
        fr: "Ce document doit t'être remis par ton (ex-)employeur dès la fin du contrat. Tu ne peux pas le remplir toi-même. S'il tarde, réclame-le par écrit : sans C4, ton organisme de paiement ne peut pas constituer ton dossier.",
      },
      internalRef:
        "Dossier chomage-complet — C4 employeur (durée prestations + motif fin contrat).",
      // Exclu uniquement pour une toute première inscription sans emploi
      // antérieur (jeune insertion orienté ailleurs en théorie, mais on
      // garde le filtre par sécurité).
      includeWhen: (a) => a.statut !== "premiere-inscription",
      fields: [],
    },
    // -----------------------------------------------------------------
    // À AJOUTER ULTÉRIEUREMENT, quand les PDFs officiels seront disponibles :
    //   - C61 (slug provisoire "c61-carte-controle") : carte de contrôle
    //     mensuelle. Requise après l'admission au chômage.
    //   - C109 (slug provisoire "c109-situation-familiale") : déclaration
    //     de la situation familiale. Requise quand `chargeFamille` est
    //     "chef-menage" ou "cohabitant-charge".
    // -----------------------------------------------------------------
  ],

  theory: THEORY,
};
