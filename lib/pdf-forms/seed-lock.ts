// Garde d'édition admin des formulaires gérés par le seed (S5 de l'audit du
// 2026-08-01, décision n°2). Module pur — ne dépend PAS de
// seed/apply-c1-improvements-core.ts (qui tire Prisma + les fonctions
// `improve` de chaque document) : l'appelant calcule `seedManaged` lui-même
// (via SEEDED_SLUGS, server-only) et passe un simple booléen ici.

import type { PdfFormField, PdfFormTrigger } from "./types";
import { sanitizeFields } from "./sanitize-fields";
import { parseTriggers } from "./triggers";

export interface SeedManagedCheckInput {
  seedManaged: boolean;
  existingFields: PdfFormField[];
  existingTriggers: PdfFormTrigger[];
  /// Valeurs brutes du body PATCH — `undefined` si la clé est absente.
  bodyFields: unknown;
  bodyTriggers: unknown;
}

/// Réponse 409 standard quand une édition de `fields`/`triggers` est refusée
/// sur un formulaire géré par le seed.
export const SEED_MANAGED_LOCK_ERROR = {
  error: "Formulaire géré par le code (seed) — édition des champs verrouillée",
  code: "seed_managed",
} as const;

/// Vrai si le body PATCH tente RÉELLEMENT de modifier `fields` ou `triggers`
/// d'un formulaire géré par le seed. Comparaison APRÈS sanitisation (mêmes
/// fonctions que l'application réelle du PATCH) : un save qui renvoie
/// fields/triggers strictement inchangés — le cas normal du bouton
/// « Enregistrer » côté client, qui les inclut toujours dans le payload même
/// pour une modification qui ne touche que l'onglet Paramètres — ne doit PAS
/// être bloqué.
export function isSeedManagedEditAttempt(input: SeedManagedCheckInput): boolean {
  if (!input.seedManaged) return false;
  const fieldsChanged =
    Array.isArray(input.bodyFields) &&
    JSON.stringify(sanitizeFields(input.bodyFields)) !== JSON.stringify(input.existingFields);
  const triggersChanged =
    Array.isArray(input.bodyTriggers) &&
    JSON.stringify(parseTriggers(input.bodyTriggers)) !== JSON.stringify(input.existingTriggers);
  return fieldsChanged || triggersChanged;
}
