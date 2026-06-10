// Dossier "Chômage frontalier" — module autonome.
//
// Couvre les travailleurs qui résident dans un État de l'EEE et travaillent
// dans un autre. Squelette fonctionnel : questions d'orientation, documents
// pivots (C1, C32 travailleur) et théorie. Les documents européens (U1 / U2
// / ED) ne sont pas encore intégrés — voir TODOs.
//
// Sources publiques uniquement (ONEM, EURES, Commission européenne) ;
// contenu paraphrasé. Aucun lien avec les autres dossiers.

import type {
  DossierDefinition,
  DossierTheorySection,
} from "../types";

/// Sections de l'espace théorique. Paraphrasées en interne à partir
/// d'informations publiques (ONEM, EURES). Audience admin/partner.
const THEORY: DossierTheorySection[] = [
  {
    id: "qui-est-concerne",
    title: "Qui est concerné ?",
    body: `
Le « chômage frontalier » regroupe les travailleurs qui résident dans un
pays de l'Espace économique européen (EEE) et travaillent dans un autre.
Plusieurs profils coexistent :

- **Frontalier classique** — tu habites dans un pays et tu travailles dans
  un autre, mais tu rentres chez toi au moins une fois par semaine.
- **Transfrontalier occasionnel** — même configuration, mais tu ne rentres
  pas chaque semaine (mission longue, logement sur place…).
- **Détaché** — ton employeur d'origine t'envoie temporairement travailler
  à l'étranger (chantier, mission). Tu restes affilié à la sécurité
  sociale de ton pays d'origine.

Pour la Belgique, les configurations les plus fréquentes sont
BE/FR, BE/LU, BE/NL et BE/DE.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "pays-competent",
    title: "Quel pays est compétent ?",
    body: `
La règle de base, posée par le règlement européen de coordination de la
sécurité sociale :

- **Chômage complet** (perte totale d'emploi) → la compétence revient au
  **pays de résidence**. Un travailleur belge frontalier en France qui
  perd son emploi s'adresse donc à l'ONEM en Belgique.
- **Chômage partiel ou temporaire** (suspension provisoire du contrat) →
  la compétence revient au **pays du dernier employeur**.

Cette règle a des conséquences importantes : le travailleur doit savoir
quel organisme contacter, et l'ONEM (ou son équivalent étranger) doit
disposer de la preuve des périodes d'occupation réalisées dans l'autre
pays. C'est là qu'intervient le formulaire U1.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
  {
    id: "formulaire-u1",
    title: "Le formulaire U1 — pourquoi il est crucial ?",
    body: `
Le **PD U1** (Portable Document U1) est délivré par l'institution de
chômage du pays où le travailleur a été occupé. Il atteste les périodes
d'assurance et d'occupation réalisées dans ce pays.

Sans U1, l'ONEM ne peut pas reconstituer la carrière à l'étranger pour
vérifier les conditions d'admissibilité. Concrètement, cela peut bloquer
ou retarder l'ouverture du droit aux allocations en Belgique.

Deux autres documents européens complètent le dispositif :

- Le **PD U2** autorise le transfert temporaire des allocations vers un
  autre pays de l'EEE pendant qu'on y cherche un emploi (durée limitée
  à 3 mois, prolongeable dans certains cas).
- Le **PD ED** sert aux échanges d'informations directs entre les
  institutions de sécurité sociale. Le travailleur n'a généralement pas
  à le manipuler — c'est un canal administratif.

Le U1 doit être demandé à l'organisme étranger compétent. Les délais de
délivrance varient fortement (de quelques semaines à plusieurs mois). Il
est donc préférable d'en faire la demande dès que l'on sait qu'on va
revenir s'inscrire au chômage dans son pays de résidence.
    `.trim(),
    audience: ["admin", "partner"],
    lastReviewedAt: "2026-06-10",
  },
];

export const chomageFrontalier: DossierDefinition = {
  slug: "chomage-frontalier",
  title: "Chômage frontalier",
  description:
    "Pour les travailleurs qui résident en Belgique mais travaillaient dans un pays voisin de l'EEE, ou inversement. Aide à constituer le dossier de chômage en coordination avec l'organisme étranger.",
  category: "emploi",
  icon: "🌍",
  color: "#0EA5E9",
  vocabularyTags: [
    "frontalier",
    "transfrontalier",
    "U1",
    "U2",
    "EURES",
    "France",
    "Luxembourg",
    "Pays-Bas",
    "Allemagne",
  ],
  types: [],

  questions: [
    {
      id: "paysResidence",
      label: { fr: "Dans quel pays habites-tu ?" },
      helpText: {
        fr: "On parle ici de ton lieu de résidence officiel — là où tu rentres dormir le plus souvent, où ta famille vit, où tu es domicilié administrativement.",
      },
      type: "select",
      options: [
        { value: "belgique", label: { fr: "Belgique" } },
        { value: "france", label: { fr: "France" } },
        { value: "luxembourg", label: { fr: "Luxembourg" } },
        { value: "pays-bas", label: { fr: "Pays-Bas" } },
        { value: "allemagne", label: { fr: "Allemagne" } },
        { value: "autre", label: { fr: "Un autre pays de l'EEE" } },
      ],
    },
    {
      id: "paysDernierEmploi",
      label: { fr: "Dans quel pays as-tu travaillé en dernier ?" },
      helpText: {
        fr: "Le pays où se trouvait ton dernier employeur, peu importe ta nationalité ou ton domicile. Si tu avais plusieurs employeurs en même temps, indique celui chez qui tu prestais le plus d'heures.",
      },
      type: "select",
      options: [
        { value: "belgique", label: { fr: "Belgique" } },
        { value: "france", label: { fr: "France" } },
        { value: "luxembourg", label: { fr: "Luxembourg" } },
        { value: "pays-bas", label: { fr: "Pays-Bas" } },
        { value: "allemagne", label: { fr: "Allemagne" } },
        { value: "autre", label: { fr: "Un autre pays de l'EEE" } },
      ],
    },
    {
      id: "typeFrontalier",
      label: { fr: "Quel type de travailleur frontalier es-tu ?" },
      helpText: {
        fr: "Frontalier classique = tu habites dans un pays et tu travailles dans un autre, et tu rentres chez toi AU MOINS 1 fois par semaine. Transfrontalier occasionnel = tu travailles à l'étranger mais tu rentres moins souvent qu'une fois par semaine (logement sur place, mission longue…). Détaché = ton employeur belge t'a envoyé temporairement travailler dans un autre pays (chantier, mission…). Tu restes affilié à la sécurité sociale belge.",
      },
      type: "select",
      options: [
        {
          value: "frontalier-classique",
          label: { fr: "Frontalier classique (je rentre chez moi au moins 1 fois par semaine)" },
        },
        {
          value: "transfrontalier-occasionnel",
          label: { fr: "Transfrontalier occasionnel (je rentre moins souvent qu'une fois par semaine)" },
        },
        {
          value: "detache",
          label: { fr: "Détaché par un employeur belge à l'étranger" },
        },
      ],
    },
    {
      id: "aDejaTouche",
      label: { fr: "As-tu déjà perçu des allocations de chômage dans l'un de ces pays ?" },
      helpText: {
        fr: "On parle d'allocations versées par un organisme officiel de chômage (ONEM en Belgique, Pôle emploi / France Travail en France, ADEM au Luxembourg, UWV aux Pays-Bas, Arbeitsagentur en Allemagne…). Si tu n'as jamais touché ce type d'allocations, réponds « non ».",
      },
      type: "boolean",
    },
    {
      id: "dureeOccupationEtranger",
      label: { fr: "Combien de temps as-tu travaillé dans ce pays à l'étranger ?" },
      helpText: {
        fr: "Indique la durée totale, même si tu as eu plusieurs contrats ou plusieurs employeurs. Cette durée est utilisée pour vérifier les conditions d'admissibilité au chômage.",
      },
      type: "select",
      options: [
        { value: "moins-1an", label: { fr: "Moins d'un an" } },
        { value: "1-5ans", label: { fr: "Entre 1 et 5 ans" } },
        { value: "5-10ans", label: { fr: "Entre 5 et 10 ans" } },
        { value: "plus-10ans", label: { fr: "Plus de 10 ans" } },
      ],
      // Ne s'affiche que si le pays de dernier emploi est différent du pays
      // de résidence (sinon ce n'est pas un cas frontalier classique).
      visibleIf: { fieldId: "paysDernierEmploi", op: "notEquals", value: "" },
    },
    {
      id: "aDemandeU1",
      label: { fr: "As-tu déjà demandé un formulaire U1 au pays où tu as travaillé ?" },
      helpText: {
        fr: "U1 = un papier officiel délivré par l'organisme de chômage du pays où tu as travaillé, qui prouve combien de temps tu y as travaillé. C'est la clé pour ouvrir tes droits ici. Sans ce document, l'ONEM ne peut pas calculer ta carrière à l'étranger.",
      },
      type: "boolean",
      visibleIf: { fieldId: "aDejaTouche", op: "equals", value: false },
    },
    {
      id: "vientChercherEmploi",
      label: { fr: "Viens-tu chercher un emploi en Belgique ?" },
      helpText: {
        fr: "Réponds « oui » si tu arrives en Belgique pour y chercher un nouveau travail (avec ou sans transfert de tes allocations via le U2). Réponds « non » si tu résides déjà en Belgique depuis longtemps et tu rentres juste t'inscrire au chômage après avoir perdu ton emploi à l'étranger.",
      },
      type: "boolean",
    },
    {
      id: "commissionParitaire",
      label: { fr: "Tu travailles dans le secteur du bâtiment / construction ?" },
      helpText: {
        fr: "On parle ici de la « Commission paritaire 124 », c'est-à-dire les ouvriers du bâtiment (maçons, peintres, électriciens sur chantier, etc.). Si tu ne sais pas, choisis « Je ne sais pas » — on adaptera.",
      },
      type: "select",
      options: [
        { value: "construction", label: { fr: "Oui — bâtiment / construction" } },
        { value: "autre", label: { fr: "Non — un autre secteur" } },
        { value: "inconnu", label: { fr: "Je ne sais pas" } },
      ],
    },
  ],

  warnings: [
    {
      title: "Demande du U1 — anticipe les délais",
      message:
        "Le formulaire U1 doit être demandé à l'institution de chômage du pays où tu as travaillé en dernier. Compte plusieurs semaines de délai. Sans U1, l'ONEM ne peut pas reconstituer ta carrière à l'étranger.",
      severity: "warning",
    },
    {
      title: "U2 — à demander avant de partir",
      message:
        "Si tu veux chercher un emploi dans un autre pays EEE en gardant tes allocations, demande le U2 AVANT de partir. Une fois sur place, il est trop tard pour ouvrir ce droit.",
      severity: "info",
    },
  ],

  documents: [
    {
      // C1 — Demande d'allocations (travailleur). Pivot pour toute ouverture
      // ou réouverture de dossier chômage côté belge.
      // Slug spécifique au dossier : les PdfForm slugs sont globaux et le
      // seed `force` supprime par slug.
      slug: "c1-chomage-frontalier",
      title: "C1 — Demande d'allocations",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef: "Doc formation — chômage frontalier, ouverture/réouverture",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
    {
      // C3.2 Travailleur — déclaration mensuelle / signalement de situation.
      // Même PDF officiel que le CT, mais slug distinct pour éviter qu'un seed
      // forcé du dossier frontalier touche les formulaires d'un autre dossier.
      slug: "c32-chomage-frontalier",
      title: "C3.2 — Travailleur",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C32_Travailleur_FR.pdf",
      internalRef: "Doc formation — formulaire central déclaration travailleur",
      fields: [
        { field: "fullName", required: true, section: "identite", pdfFieldName: "Nom Prénom du travailleur" },
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
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
        { field: "creationDate", pdfFieldName: "Aujourd'hui" },
        { field: "signature", pdfFieldName: "Signature" },
      ],
    },
    // TODO: Ajouter le formulaire PD U1 (Portable Document U1) une fois que
    // le PDF officiel européen sera disponible dans private/pdfs/. Ce
    // document est délivré par l'organisme de chômage du pays où le
    // travailleur a été occupé en dernier et atteste les périodes
    // d'assurance. À inclure quand `paysDernierEmploi !== paysResidence`
    // ET `aDemandeU1 !== true`.
    //
    // TODO: Ajouter le formulaire PD U2 quand le PDF officiel sera
    // disponible. Sert au transfert temporaire des allocations vers un
    // autre pays de l'EEE pour y chercher un emploi (≤ 3 mois).
    //
    // TODO: Ajouter le formulaire PD ED (échange d'informations entre
    // institutions). Le travailleur n'y touche normalement pas, mais on
    // pourra le tracer dans le dossier à titre informatif.
  ],

  theory: THEORY,
};
