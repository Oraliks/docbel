// Registry des règles de mapping par slug.
//
// Le moteur (`resolveStamps`) reçoit son tableau de règles ici. Ajouter un
// nouveau formulaire = ajouter une entrée. Un slug sans règles renvoie un
// tableau vide → aucun stamp additionnel = comportement identique au
// mapping schéma seul (safe par défaut).

import type { MappingRule } from "./types";
import { C1_CHANGEMENT_RULES } from "./per-form/c1-changement";

const RULES_BY_SLUG: Record<string, MappingRule[]> = {
  "c1-changement-situation": C1_CHANGEMENT_RULES,
  // Phase 7 :
  //   - "c1" (première demande) et "c1-insertion" — extension de la famille
  //     C1 (composer depuis une base commune) ;
  //   - "c1a", "c1b", "c1c", "c46", "c47", "c1-partenaire", "c1-regis" —
  //     un jeu de règles par compagnon.
};

/// Récupère les règles à appliquer pour un slug donné. Renvoie un tableau
/// vide si le slug n'a aucun mapping (comportement neutre — équivaut à ne
/// pas passer `extraStamps` au filler).
export function getRulesForSlug(slug: string): MappingRule[] {
  return RULES_BY_SLUG[slug] ?? [];
}
