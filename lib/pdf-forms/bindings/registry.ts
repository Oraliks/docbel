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

const RULES_BY_SLUG: Record<string, MappingRule[]> = {
  "c1-changement-situation": C1_CHANGEMENT_RULES,
  c1a: C1A_RULES,
  c1b: C1B_RULES,
  // Le C1C n'a besoin d'AUCUNE règle : aucun de ses widgets ne fusionne
  // plusieurs informations, et son « Prénom et nom » est un champ `fullname`
  // que le filler assemble tout seul.
  //
  // Restent à brancher : c46 / c47 / c1-partenaire / c1-regis.
  // Chacun demande un dump AcroForm dédié (noms de widgets EXACTS) — un slug
  // sans entrée ici renvoie [] et se comporte comme avant, sans stamp
  // additionnel : l'absence est sûre, elle n'est simplement pas complète.
};

/// Récupère les règles à appliquer pour un slug donné. Renvoie un tableau
/// vide si le slug n'a aucun mapping (comportement neutre — équivaut à ne
/// pas passer `extraStamps` au filler).
export function getRulesForSlug(slug: string): MappingRule[] {
  return RULES_BY_SLUG[slug] ?? [];
}
