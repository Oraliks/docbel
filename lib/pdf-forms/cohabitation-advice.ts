import type { FieldValueRecord } from "./types";

/**
 * Conseil de parcours pour la grille familiale C1.
 *
 * Quand le demandeur vit avec une seule autre personne et que celle-ci est
 * encore déclarée « aucun lien », il peut être utile de vérifier s'il s'agit
 * en réalité d'une personne financièrement à charge (FAC). Cette indication
 * n'impose jamais le choix FAC : elle attire simplement l'attention de
 * l'utilisateur avant la validation du formulaire.
 */
export function getCohabitationAdvice(rows: FieldValueRecord[]): "consider-fac" | null {
  if (rows.length !== 1) return null;
  return rows[0]?.lien === "aucun-lien" ? "consider-fac" : null;
}
