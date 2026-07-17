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
    titleKey: "complet.theory.quiPeutBeneficier.title",
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
    bodyKey: "complet.theory.quiPeutBeneficier.body",
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "delai-8-jours",
    title: "Le délai de 8 jours",
    titleKey: "complet.theory.delai8Jours.title",
    body: `
L'introduction de la demande doit intervenir rapidement après la fin du
contrat de travail. En pratique, on retient un repère simple : **8 jours
ouvrables** à partir du jour qui suit la fin du contrat pour s'inscrire
comme demandeur d'emploi auprès du service régional et déposer le
dossier auprès de l'organisme de paiement (FGTB, CSC, SYNOVA ou CAPAC).

Un dépôt tardif n'éteint pas le droit, mais peut entraîner une perte
des allocations pour la période couverte par le retard. En cas de
difficulté (maladie, démarches en cours), le partenaire doit pouvoir
documenter la cause du retard pour la faire valoir auprès de l'ONEM.

Source publique de référence : www.onem.be.
    `.trim(),
    bodyKey: "complet.theory.delai8Jours.body",
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "documents-a-preparer",
    title: "Les documents à préparer",
    titleKey: "complet.theory.documentsAPreparer.title",
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
    bodyKey: "complet.theory.documentsAPreparer.body",
    audience: ["admin", "partner"],
    bindings: ["documents"],
    lastReviewedAt: "2026-06-10",
  },
];

export const chomageComplet: DossierDefinition = {
  slug: "chomage-complet",
  title: "Chômage complet",
  titleKey: "complet.title",
  description:
    "Aide à constituer le dossier de chômage complet après une perte d'emploi (licenciement, démission, fin de CDD) ou pour une première inscription.",
  descriptionKey: "complet.description",
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

  // Conserve dans le run les faits sûrs déjà connus par l'assistant. Ils
  // restent utiles comme contexte, mais ne déclenchent plus un second
  // questionnaire avant le C1.
  prefillFromOrientation: (o) => {
    const out: Record<string, string> = {};
    // « Est-ce votre toute première demande de chômage ? »
    if (o.refine === "premiere") out.aDejaTouche = "false";
    if (o.refine === "redemande") out.aDejaTouche = "true";
    // Les libellés du wizard précisent explicitement « salarié » :
    // « J'ai travaillé un bon moment en Belgique » (passé salarié) et
    // « Avez-vous déjà travaillé (salarié) ? » → Oui.
    if (o.subOption === "passe-travail-be" || o.refine === "a-travaille") {
      out.statut = "salarie";
    }
    return out;
  },

  // Le C1 est désormais le formulaire de collecte unique : l'assistant a déjà
  // choisi le bon dossier et le Form Runner pose les questions utiles, section
  // par section. Aucun écran de selects ne doit s'intercaler entre les deux.
  // Questions de l'assistant Mon dossier. Elles enrichissent l'orientation
  // sans modifier le C1 officiel : les réponses sont préremplies dans le C1,
  // puis restent entièrement modifiables par la personne.
  questions: [
    {
      id: "famille_situation",
      label: { fr: "Avec qui vis-tu actuellement ?", nl: "", de: "" },
      helpText: {
        fr: "Choisis conjoint si tu es marié, partenaire si vous vivez en couple sans être mariés, ou aucun lien pour une personne qui n'est ni famille ni partenaire.",
        nl: "", de: "",
      },
      type: "select",
      options: [
        { value: "isole", label: { fr: "Je vis seul(e)", nl: "", de: "" } },
        { value: "conjoint", label: { fr: "Mon conjoint (marié)", nl: "", de: "" } },
        { value: "partenaire", label: { fr: "Mon partenaire", nl: "", de: "" } },
        { value: "aucun-lien", label: { fr: "Une personne sans lien familial ou de couple", nl: "", de: "" } },
      ],
    },
    {
      id: "famille_colocation",
      label: { fr: "Est-ce une colocation où chacun gère sa vie séparément ?", nl: "", de: "" },
      helpText: {
        fr: "Si oui, ne détaille pas le colocataire dans le C1 : l'Annexe REGIS sera proposée ensuite.",
        nl: "", de: "",
      },
      type: "select",
      options: [
        { value: "oui", label: { fr: "Oui, c'est une colocation", nl: "", de: "" } },
        { value: "non", label: { fr: "Non, nous formons un ménage commun", nl: "", de: "" } },
      ],
      visibleIf: { fieldId: "famille_situation", op: "equals", value: "aucun-lien" },
    },
    {
      id: "famille_charge",
      label: { fr: "Cette personne dépend-elle principalement de tes revenus ?", nl: "", de: "" },
      helpText: {
        fr: "Réponds oui seulement si tu prends réellement cette personne en charge. L'organisme de paiement vérifiera les preuves.",
        nl: "", de: "",
      },
      type: "select",
      options: [
        { value: "oui", label: { fr: "Oui, elle dépend principalement de moi", nl: "", de: "" } },
        { value: "non", label: { fr: "Non", nl: "", de: "" } },
      ],
      visibleIf: { fieldId: "famille_situation", op: "in", value: ["partenaire", "aucun-lien"] },
    },
    {
      id: "famille_enfants",
      label: { fr: "Y a-t-il des enfants dans ton ménage ?", nl: "", de: "" },
      helpText: {
        fr: "Cette réponse permet de préparer les questions sur les allocations familiales, les revenus d'un enfant et la garde alternée.",
        nl: "", de: "",
      },
      type: "select",
      options: [
        { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
        { value: "non", label: { fr: "Non", nl: "", de: "" } },
      ],
    },
    {
      id: "famille_pension",
      label: { fr: "Paies-tu une pension alimentaire ?", nl: "", de: "" },
      helpText: {
        fr: "Si oui, prépare le jugement, l'acte notarié ou la preuve de l'état de besoin si elle est disponible.",
        nl: "", de: "",
      },
      type: "select",
      options: [
        { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
        { value: "non", label: { fr: "Non", nl: "", de: "" } },
      ],
      visibleIf: { fieldId: "famille_situation", op: "equals", value: "isole" },
    },
    {
      id: "famille_garde_alternee",
      label: { fr: "Un enfant vit-il régulièrement chez toi en garde alternée ?", nl: "", de: "" },
      helpText: {
        fr: "Le C1 demandera ensuite les jours de présence et les éventuels justificatifs.",
        nl: "", de: "",
      },
      type: "select",
      options: [
        { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
        { value: "non", label: { fr: "Non", nl: "", de: "" } },
      ],
      visibleIf: { fieldId: "famille_enfants", op: "equals", value: "oui" },
    },
    {
      id: "famille_premier_revenu_enfant",
      label: { fr: "Un enfant commence-t-il son premier travail après ses études ?", nl: "", de: "" },
      helpText: {
        fr: "Si oui, le C1 pourra demander la neutralisation temporaire du revenu pendant 12 mois.",
        nl: "", de: "",
      },
      type: "select",
      options: [
        { value: "oui", label: { fr: "Oui", nl: "", de: "" } },
        { value: "non", label: { fr: "Non", nl: "", de: "" } },
      ],
      visibleIf: { fieldId: "famille_enfants", op: "equals", value: "oui" },
    },
  ],

  warnings: [
    {
      title: "Délai d'inscription : 8 jours",
      titleKey: "complet.warning.delaiInscription.title",
      message:
        "Inscris-toi auprès du service régional de l'emploi (FOREM / ACTIRIS / VDAB / ADG) dans les 8 jours ouvrables qui suivent la fin de ton contrat. Un dépôt tardif peut entraîner la perte des allocations pour la période couverte par le retard.",
      messageKey: "complet.warning.delaiInscription.message",
      severity: "warning",
    },
    {
      title: "Documents employeur à demander",
      titleKey: "complet.warning.documentsEmployeur.title",
      message:
        "Le C4 (certificat de chômage) doit t'être remis par ton employeur dès la fin du contrat. S'il tarde, réclame-le par écrit : sans C4, ton organisme de paiement ne peut pas constituer ton dossier.",
      messageKey: "complet.warning.documentsEmployeur.message",
      severity: "info",
    },
  ],

  documents: [
    {
      // C4 — Certificat de chômage. OBLIGATOIRE au dossier mais c'est
      // l'EMPLOYEUR qui doit le délivrer : le citoyen ne le remplit pas
      // lui-même dans beldoc. On le liste quand même (required) pour que la
      // personne sache qu'il doit figurer au dossier et le réclamer.
      // Pas de sourcePdfPath / fields : non remplissable côté citoyen.
      slug: "c4-employeur",
      title: "C4 — Certificat de chômage (à fournir par l'employeur)",
      titleKey: "complet.doc.c4.title",
      issuer: "Employeur",
      required: true,
      responsibility: "employer",
      responsibilityNote: {
        fr: "Ce document doit t'être remis par ton (ex-)employeur dès la fin du contrat. Tu ne peux pas le remplir toi-même. S'il tarde, réclame-le par écrit : sans C4, ton organisme de paiement ne peut pas constituer ton dossier.",
      },
      internalRef:
        "Dossier chomage-complet — C4 employeur (durée prestations + motif fin contrat).",
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

  journeyCtaLabel: "Commencer mon dossier de chômage",
  journeyCtaLabelKey: "complet.journeyCtaLabel",
  journey: [
    {
      order: 1,
      icon: "user-check",
      title: "Commence ton formulaire C1",
      titleKey: "complet.journey.step1.title",
      body: "L'assistant a déjà choisi le bon dossier. Tu peux répondre directement dans le formulaire, étape par étape.",
      bodyKey: "complet.journey.step1.body",
    },
    {
      order: 2,
      icon: "file-check",
      title: "Remplis ton formulaire C1",
      titleKey: "complet.journey.step2.title",
      body: "Nous avançons partie par partie : identité, famille, activités, revenus et paiement. Tu peux relire et corriger avant de terminer.",
      bodyKey: "complet.journey.step2.body",
    },
    {
      order: 3,
      icon: "calendar",
      title: "Demande ton C4 à ton employeur",
      titleKey: "complet.journey.step3.title",
      body: "Le C4 est préparé par ton ancien employeur. Si tu ne l'as pas reçu, le dossier t'explique comment le réclamer.",
      bodyKey: "complet.journey.step3.body",
    },
    {
      order: 4,
      icon: "wallet",
      title: "Transmets ton dossier",
      titleKey: "complet.journey.step4.title",
      body: "Après vérification, remets les documents à ton organisme de paiement : la CAPAC ou ton syndicat.",
      bodyKey: "complet.journey.step4.body",
    },
  ],

  theory: THEORY,
};
