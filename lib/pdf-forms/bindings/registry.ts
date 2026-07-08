// Registry des règles de mapping par slug.
//
// Le moteur (`resolveStamps`) reçoit son tableau de règles ici. Ajouter un
// nouveau formulaire = ajouter une entrée. Un slug sans règles renvoie un
// tableau vide → aucun stamp additionnel = comportement identique au
// mapping schéma seul (safe par défaut).

import type { MappingRule } from "./types";
import { C1_CHANGEMENT_RULES } from "./per-form/c1-changement";

/// Les 3 slugs de la famille C1 (première demande, insertion, changement de
/// situation) partagent le MÊME PDF source + le même schéma enrichi (cf.
/// `applyC1Improvements`) → ils partagent aussi le même jeu de règles de
/// bindings. Les règles c1-changement sont CONDITIONNELLES sur des champs
/// qui n'existent pas toujours dans les autres variantes
/// (`transfereOrganismePaiement`, chips motif) : le moteur `evaluateWhen`
/// retourne alors `false` et la règle ne fire pas → aucun effet de bord.
/// Retirer les 6 transforms client (Phase 7 stricte) après validation prod
/// Oraliks n'est PAS bloqué par ce partage — c'est même la raison pour
/// laquelle on l'introduit maintenant : la génération PDF cross-variante
/// devient cohérente.
const RULES_BY_SLUG: Record<string, MappingRule[]> = {
  "c1-changement-situation": C1_CHANGEMENT_RULES,
  "c1": C1_CHANGEMENT_RULES,
  "c1-insertion": C1_CHANGEMENT_RULES,
  // Phase 7 (compagnons) : c1a / c1b / c1c / c46 / c47 / c1-partenaire /
  // c1-regis nécessitent chacun un dump AcroForm dédié (widget names
  // exacts) — geste manuel non fait dans cette session.
};

/// Récupère les règles à appliquer pour un slug donné. Renvoie un tableau
/// vide si le slug n'a aucun mapping (comportement neutre — équivaut à ne
/// pas passer `extraStamps` au filler).
export function getRulesForSlug(slug: string): MappingRule[] {
  return RULES_BY_SLUG[slug] ?? [];
}
