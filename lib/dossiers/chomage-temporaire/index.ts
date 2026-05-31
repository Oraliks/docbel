// Dossier "Chômage temporaire" — module autonome.
//
// Décrit ses 7 motifs, ses questions d'orientation, ses documents (avec leur
// logique d'inclusion conditionnelle) et ses avertissements. Les champs
// référencent le catalogue partagé. Aucun lien avec les autres dossiers.

import type { DossierDefinition } from "../types";

/// Les 7 motifs de chômage temporaire (source de l'animation de la page +
/// des options de la question d'orientation).
export const MOTIFS = [
  "Économique",
  "Action sociale",
  "Vacances annuelles",
  "Repos compensatoire",
  "Intempéries",
  "Accident technique",
  "Force majeure",
] as const;

export type Motif = (typeof MOTIFS)[number];

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
  ],
  types: [...MOTIFS],

  questions: [
    {
      id: "motif",
      label: { fr: "Quel est le motif du chômage temporaire ?" },
      type: "select",
      options: MOTIFS.map((m) => ({ value: m, label: { fr: m } })),
    },
    {
      id: "statut",
      label: { fr: "Vous êtes ouvrier ou employé ?" },
      type: "select",
      options: [
        { value: "ouvrier", label: { fr: "Ouvrier" } },
        { value: "employe", label: { fr: "Employé" } },
      ],
    },
    {
      id: "premiereDemande",
      label: { fr: "Est-ce votre première demande pour ce motif ?" },
      type: "boolean",
    },
  ],

  warnings: [
    {
      title: "Délai légal de 7 jours",
      message:
        "Vous devez introduire votre demande dans les 7 jours calendrier qui suivent votre dernier jour effectivement presté.",
      severity: "critical",
    },
  ],

  documents: [
    {
      // Toujours requis.
      slug: "c32a-carte-controle",
      title: "C3.2A — Carte de contrôle",
      issuer: "ONEM",
      required: true,
      fields: [
        { field: "fullName", required: true, section: "identite" },
        { field: "niss", required: true, section: "identite" },
        { field: "street", section: "adresse" },
        { field: "postalCode", section: "adresse" },
        { field: "city", section: "adresse" },
        { field: "creationDate", section: "declaration" },
        { field: "signature", required: true, section: "signature" },
      ],
    },
    {
      slug: "c32-employeur",
      title: "C3.2-Employeur",
      issuer: "ONEM",
      required: true,
      fields: [
        { field: "fullName", required: true, section: "identite" },
        { field: "niss", required: true, section: "identite" },
        { field: "employerName", required: true, section: "employeur" },
        { field: "employerBce", section: "employeur" },
        { field: "creationDate", section: "declaration" },
        { field: "signature", required: true, section: "signature" },
      ],
    },
    {
      // Uniquement pour le motif "Force majeure".
      slug: "c32a-force-majeure",
      title: "C3.2A — Force majeure",
      issuer: "ONEM",
      includeWhen: (a) => a.motif === "Force majeure",
      fields: [
        { field: "fullName", required: true, section: "identite" },
        { field: "niss", required: true, section: "identite" },
        {
          custom: {
            key: "evenement",
            pdfFieldName: "Event",
            type: "textarea",
            label: { fr: "Description de l'évènement de force majeure" },
          },
          required: true,
          section: "declaration",
        },
        { field: "creationDate", section: "declaration" },
        { field: "signature", required: true, section: "signature" },
      ],
    },
    {
      // Uniquement pour le motif "Intempéries".
      slug: "c32a-intemperies",
      title: "C3.2A — Intempéries",
      issuer: "ONEM",
      includeWhen: (a) => a.motif === "Intempéries",
      fields: [
        { field: "fullName", required: true, section: "identite" },
        { field: "niss", required: true, section: "identite" },
        {
          custom: {
            key: "natureIntemperie",
            pdfFieldName: "WeatherKind",
            type: "text",
            label: { fr: "Nature de l'intempérie (gel, pluie, neige…)" },
          },
          required: true,
          section: "declaration",
        },
        { field: "creationDate", section: "declaration" },
        { field: "signature", required: true, section: "signature" },
      ],
    },
  ],
};
