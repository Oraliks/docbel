// Décide ce qu'un re-semis doit écrire (S6 de l'audit du 2026-08-01).
//
// Module PUR — aucune dépendance Prisma, contrairement à
// `apply-c1-improvements-core.ts` qui l'appelle : la règle « une révision
// seulement si les champs changent vraiment » est ainsi testable sans base.

import { isDeepStrictEqual } from "node:util";

/// Deux valeurs JSON portent-elles le même contenu ?
///
/// Comparaison NORMALISÉE, et c'est essentiel : Prisma réordonne les clés
/// d'une colonne Json qu'il relit et n'en restitue jamais les propriétés
/// `undefined`. Un `JSON.stringify(a) !== JSON.stringify(b)` — la comparaison
/// du PATCH admin — verrait donc une différence à chaque re-semis, sur un
/// contenu pourtant identique : révision et bump de version à chaque passage,
/// exactement ce qu'un sync idempotent ne doit pas produire.
export function sameSeedJson(left: unknown, right: unknown): boolean {
  const normalize = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null));
  return isDeepStrictEqual(normalize(left), normalize(right));
}

export interface SeedSyncInput {
  /// Colonnes brutes relues en base (type `Json` côté Prisma).
  existingFields: unknown;
  existingTriggers: unknown;
  /// Sortie de `target.improve(...)` et `target.triggers`.
  improvedFields: unknown;
  targetTriggers: unknown;
}

export interface SeedSyncPlan {
  fieldsChanged: boolean;
  triggersChanged: boolean;
  /// Faux ⇒ ne rien écrire du tout. Toucher la ligne pour rien décalerait
  /// `updatedAt`, ce qui n'est pas neutre : c'est le jeton du verrou optimiste
  /// du PATCH admin, et `checkPublishable` s'en sert pour juger un brouillon
  /// visuel « modifié depuis la dernière matérialisation » (un formulaire
  /// publiable deviendrait bloqué par un simple re-semis à vide).
  needsWrite: boolean;
  /// Une `PdfFormRevision` est un instantané de `fields` : seul un changement
  /// de champs en justifie une (même règle que le PATCH admin, qui n'en crée
  /// pas pour un changement de déclencheurs seul).
  needsRevision: boolean;
}

export function planSeedSync(input: SeedSyncInput): SeedSyncPlan {
  const fieldsChanged = !sameSeedJson(input.existingFields, input.improvedFields);
  const triggersChanged = !sameSeedJson(input.existingTriggers, input.targetTriggers);
  return {
    fieldsChanged,
    triggersChanged,
    needsWrite: fieldsChanged || triggersChanged,
    needsRevision: fieldsChanged,
  };
}
