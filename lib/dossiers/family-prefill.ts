/**
 * Faits de situation familiale recueillis par l'assistant Mon dossier
 * -> valeurs initiales du formulaire C1. Les clés sont volontairement
 * indépendantes du texte affiché : le C1 reste le formulaire officiel et
 * l'utilisateur peut toujours corriger chaque valeur.
 */

export type FamilyAssistantAnswers = Record<string, string | undefined>;

export function familyAnswersToC1Prefill(
  answers: FamilyAssistantAnswers,
): Record<string, string | Array<{ lien: string }>> {
  const situation = answers.famille_situation;
  if (!situation) return {};

  if (situation === "isole") {
    return {
      statutFamilial: "isole",
      ...(answers.famille_colocation === "oui"
        ? { habiteEnColocation: "oui" }
        : {}),
    };
  }

  // Conjoint, partenaire et personne sans lien vivent d'abord dans un ménage
  // commun. Le cas « aucun lien + colocation » est explicitement rebasculé
  // vers isolé par la question suivante de l'assistant.
  if (situation === "aucun-lien" && answers.famille_colocation === "oui") {
    return { statutFamilial: "isole", cohabiteType: "colocation", habiteEnColocation: "oui" };
  }

  const lien = situation === "conjoint"
    ? "epoux"
    : situation === "partenaire"
      ? "partenaire"
      : answers.famille_charge === "oui"
        ? "FAC"
        : "aucun-lien";

  return {
    statutFamilial: "cohabite",
    cohabiteType: "menage-commun",
    cohabitants: [{ lien }],
  };
}
