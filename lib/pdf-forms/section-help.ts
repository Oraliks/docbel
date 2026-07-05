// Textes d'aide contextuelle par section, affichés dans ContextHelpPanel.
// FR uniquement dans ce lot (précédent établi : cf. NEXT_ACTIONS #20) — pas
// de titreKey/bodyKey ici, ce n'est pas du contenu i18n-critique (aide
// secondaire, dégrade proprement en restant en FR pour les autres locales).

import type { Locale } from "./types";

export interface SectionHelp {
  title: string;
  body: string;
  examples?: string[];
}

const HELP: Record<string, SectionHelp> = {
  identite: {
    title: "Votre identité",
    body: "Vérifiez que votre nom, prénom et numéro NISS correspondent à votre carte d'identité.",
  },
  adresse: {
    title: "Votre adresse",
    body: "Indiquez l'adresse à laquelle vous habitez actuellement (celle de votre domiciliation officielle).",
  },
  demande: {
    title: "Comprendre cette étape",
    body: "Indiquez la nature du changement intervenu dans votre situation.",
    examples: ["Mariage, séparation", "Déménagement", "Nouveau revenu", "Changement d'emploi", "Naissance ou départ d'un enfant"],
  },
  "situation-familiale": {
    title: "Votre situation familiale",
    body: "Ces informations déterminent votre catégorie (isolé, cohabitant, chef de ménage) et donc le montant de vos allocations.",
  },
  "mes-activites": {
    title: "Vos activités",
    body: "Toute activité professionnelle, même accessoire, doit être déclarée — elle peut nécessiter un formulaire complémentaire.",
  },
  "mes-revenus": {
    title: "Vos revenus",
    body: "Ces questions permettent de vérifier si un autre revenu de remplacement doit être pris en compte.",
  },
  "mode-paiement": {
    title: "Votre compte bancaire",
    body: "Le compte sur lequel vos allocations seront versées.",
  },
  "cotisation-syndicale": {
    title: "Cotisation syndicale",
    body: "Concerne la retenue de la cotisation syndicale sur vos allocations, si applicable.",
  },
  "non-eee": {
    title: "Hors Espace économique européen",
    body: "Ces questions concernent les travailleurs venant d'un pays hors UE/EEE/Suisse.",
  },
  divers: {
    title: "Informations complémentaires",
    body: "Quelques questions additionnelles nécessaires à l'examen de votre dossier.",
  },
  affirmations: {
    title: "Déclaration sur l'honneur",
    body: "Ces affirmations engagent votre responsabilité — relisez-les avant de continuer.",
  },
  annexes: {
    title: "Annexes",
    body: "Documents ou informations complémentaires, à fournir seulement si votre situation le nécessite.",
  },
};

const FALLBACK: Record<Locale, SectionHelp> = {
  fr: { title: "Pourquoi ces questions ?", body: "Ces informations permettent d'actualiser votre dossier et de vérifier si vos droits peuvent changer." },
  nl: { title: "Pourquoi ces questions ?", body: "Ces informations permettent d'actualiser votre dossier et de vérifier si vos droits peuvent changer." },
  de: { title: "Pourquoi ces questions ?", body: "Ces informations permettent d'actualiser votre dossier et de vérifier si vos droits peuvent changer." },
};

/// Renvoie l'aide contextuelle pour une section. Repli générique si la
/// section n'a pas d'entrée dédiée (ex. un formulaire compagnon dont les
/// sections n'ont pas encore été documentées ici) — ne renvoie jamais une
/// chaîne vide.
export function getSectionHelp(key: string | undefined, lang: Locale): SectionHelp {
  if (key && HELP[key]) return HELP[key];
  return FALLBACK[lang] ?? FALLBACK.fr;
}
