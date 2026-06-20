/**
 * Règle métier : un article ne peut PAS être mis en ligne (publié) — ni
 * planifié, puisqu'une planification débouche sur une publication — sans
 * illustration de hero dédiée (`News.heroIllustration`).
 *
 * La bannière OG (`News.image`) ne compte PAS : le hero d'article n'affiche
 * que `heroIllustration`. On centralise ici message + test pour que toutes les
 * voies de publication (route publish, schedule, bulk-action, PATCH, POST)
 * appliquent exactement la même règle.
 */
export const HERO_REQUIRED_MESSAGE =
  "Une illustration de hero est requise pour publier l'article. Générez-la dans l'éditeur (section « Illustration du hero »).";

/** `true` si la valeur est une URL d'illustration non vide. */
export function hasHeroIllustration(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}
