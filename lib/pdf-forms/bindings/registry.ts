// Registry des règles de mapping par slug.
//
// Le moteur (`resolveStamps`) reçoit son tableau de règles ici. Ajouter un
// nouveau formulaire = ajouter une entrée. Un slug sans règles renvoie un
// tableau vide → aucun stamp additionnel = comportement identique au
// mapping schéma seul (safe par défaut).

import type { MappingRule } from "./types";
import { C1_CHANGEMENT_RULES } from "./per-form/c1-changement";
import { C1A_RULES } from "./per-form/c1a";
import { C1B_RULES } from "./per-form/c1b";
import { C47_RULES } from "./per-form/c47";

const RULES_BY_SLUG: Record<string, MappingRule[]> = {
  "c1-changement-situation": C1_CHANGEMENT_RULES,
  c1a: C1A_RULES,
  c1b: C1B_RULES,
  c47: C47_RULES,
  // Les 8 formulaires sont branchés. Ceux qui n'ont pas d'entrée ici — c1c,
  // c46, c1-regis, c1-partenaire — n'en ont pas BESOIN : aucun de leurs
  // widgets ne fusionne plusieurs informations, et leurs champs « nom et
  // prénom » sont de type `fullname`, que le filler assemble tout seul.
  // Un slug absent renvoie [] : pas de stamp additionnel, comportement
  // strictement identique au mapping du schéma seul.
};

/// Récupère les règles à appliquer pour un slug donné. Renvoie un tableau
/// vide si le slug n'a aucun mapping (comportement neutre — équivaut à ne
/// pas passer `extraStamps` au filler).
export function getRulesForSlug(slug: string): MappingRule[] {
  return RULES_BY_SLUG[slug] ?? [];
}
