// Dossier "Changement dans ma situation personnelle" — pour toute personne
// DÉJÀ indemnisée (insertion, chômage complet, temporaire...) qui doit
// signaler un changement à son organisme de paiement : adresse, compte
// bancaire, situation familiale/ménage, permis de séjour, cotisation
// syndicale, ou changement d'organisme de paiement.
//
// Réutilise entièrement l'infrastructure C1 existante : le PdfForm
// "c1-changement-situation" utilise les champs enrichis et les triggers
// dédiés au changement de situation, avec le motif d'introduction
// pré-sélectionné sur "modification" (éditable — la personne peut aussi
// choisir "changement d'organisme de paiement").
//
// Pas de questionnaire d'orientation (`questions: []`) : l'interaction se
// fait DANS le formulaire C1 lui-même (déjà organisé en sections), pas en
// amont — conforme à l'abandon du système d'aiguillage.

import type { DossierDefinition, DossierTheorySection } from "../types";

const THEORY: DossierTheorySection[] = [
  {
    id: "transferts-organisme-paiement",
    title: "Délais des transferts d'organisme de paiement",
    titleKey: "changementSituation.theory.transfertsOp.title",
    body: `
Le délai d'introduction et la prise d'effet d'un transfert d'organisme de
paiement dépendent du type d'allocation en cours :

- **Chômage complet / AGR** : demande à introduire au plus tard le dernier
  jour du mois précédant celui visé par le transfert ; prise d'effet le
  1ᵉʳ jour du mois suivant la réception du flux par le bureau du chômage.
- **Chômage temporaire** : demande à introduire au plus tard le dernier jour
  du 2ᵉ mois qui suit celui visé ; prise d'effet dès le 1ᵉʳ jour du mois
  visé (sauf chômage temporaire déjà indemnisé pour ce mois).

Source interne (formation partenaire) — paraphrasé, jamais cité verbatim.
    `.trim(),
    bodyKey: "changementSituation.theory.transfertsOp.body",
    audience: ["admin", "partner"],
    internalRef: "Slide interne « Transferts d'OP » (formation partenaire), reçue 2026-07-05.",
    lastReviewedAt: "2026-07-05",
  },
];

export const changementSituationPersonnelle: DossierDefinition = {
  slug: "changement-situation-personnelle",
  title: "Changement dans ma situation personnelle",
  titleKey: "changementSituation.title",
  description:
    "Déclare un changement d'adresse, de compte bancaire, de situation familiale, de permis de séjour, de cotisation syndicale ou d'organisme de paiement pendant que tu touches des allocations.",
  descriptionKey: "changementSituation.description",
  category: "emploi",
  icon: "🔄",
  color: "#7C3AED",
  vocabularyTags: [
    "changement d'adresse",
    "déménagement chômage",
    "changement de compte bancaire",
    "situation familiale",
    "permis de séjour",
    "cotisation syndicale",
    "changement d'organisme de paiement",
    "transfert FGTB CSC CAPAC SYNOVA",
    "C1 modification",
  ],
  types: [],
  questions: [],
  warnings: [
    {
      title: "Une seule date par déclaration",
      titleKey: "changementSituation.warning.uneSeuleDate.title",
      message:
        "Si tes changements n'ont pas tous la même date d'effet, fais une déclaration séparée pour chaque date différente.",
      messageKey: "changementSituation.warning.uneSeuleDate.message",
      severity: "info",
    },
  ],
  documents: [
    {
      slug: "c1-changement-situation",
      title: "C1 — Déclaration de changement de situation",
      titleKey: "changementSituation.doc.c1.title",
      issuer: "ONEM",
      required: true,
      sourcePdfPath: "private/pdfs/C1_FR.pdf",
      internalRef:
        "Dossier changement-situation-personnelle, document unique (motif « modification » / « changement d'organisme »).",
      fields: [
        { field: "niss", required: true, section: "identite", pdfFieldName: "NISS" },
      ],
    },
  ],
  journeyCtaLabel: "Déclarer mon changement",
  journeyCtaLabelKey: "changementSituation.journeyCtaLabel",
  journey: [
    {
      order: 1,
      icon: "user-check",
      title: "Ta situation a changé",
      titleKey: "changementSituation.journey.step1.title",
      body: "Déménagement, nouveau compte bancaire, changement familial, permis de séjour ou envie de changer d'organisme de paiement : ce formulaire couvre ces cas.",
      bodyKey: "changementSituation.journey.step1.body",
    },
    {
      order: 2,
      icon: "file-check",
      title: "Un seul C1 pour plusieurs changements",
      titleKey: "changementSituation.journey.step2.title",
      body: "Tu peux cocher plusieurs cases à la fois si elles prennent effet à la même date. Sinon, fais une déclaration séparée par date.",
      bodyKey: "changementSituation.journey.step2.body",
    },
    {
      order: 3,
      icon: "calendar",
      title: "Prépare tes informations",
      titleKey: "changementSituation.journey.step3.title",
      body: "Nouvelle adresse, IBAN, date d'effet : aie ces éléments sous la main avant de commencer.",
      bodyKey: "changementSituation.journey.step3.body",
    },
    {
      order: 4,
      icon: "wallet",
      title: "Envoi à ton organisme de paiement",
      titleKey: "changementSituation.journey.step4.title",
      body: "Une fois complété, le C1 (et les formulaires complémentaires si besoin) part vers ton organisme de paiement (FGTB, CSC, SYNOVA, CAPAC).",
      bodyKey: "changementSituation.journey.step4.body",
    },
  ],
  theory: THEORY,
};
