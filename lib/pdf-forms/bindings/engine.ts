// Moteur d'évaluation des règles de mapping.
//
// Module PUR : aucun import fs/prisma/DB — importable partout (client, admin,
// tests). Il évalue les `MappingRule` déclaratives (cf. ./types.ts) sur un
// payload de formulaire et produit une Map `widget → valeur` que le filler
// applique APRÈS la boucle standard sur les champs (les règles gagnent).

import type { FieldValue, FormPayload } from "../types";
import type {
  MappingRule,
  StampEntry,
  WhenClause,
  WhenCondition,
} from "./types";
import { formatDateFR } from "./format";

// ---------------------------------------------------------------------------
// Évaluation des conditions
// ---------------------------------------------------------------------------

/// Évalue UNE `WhenCondition` sur la valeur `actual` du payload. Regex : la
/// valeur est coercée en string (`String(actual ?? "")`) avant le test —
/// utile pour tester un préfixe pays sur un IBAN par exemple.
function matchCondition(actual: FieldValue | undefined, cond: WhenCondition): boolean {
  // Forme brute (string/number/boolean) → égalité stricte.
  if (typeof cond === "string" || typeof cond === "number" || typeof cond === "boolean") {
    return actual === cond;
  }
  if ("equals" in cond) return actual === cond.equals;
  if ("not" in cond) return actual !== cond.not;
  if ("in" in cond) {
    if (actual === null || actual === undefined) return false;
    return (cond.in as readonly (string | number)[]).includes(actual as string | number);
  }
  if ("matches" in cond) {
    try {
      return new RegExp(cond.matches).test(String(actual ?? ""));
    } catch {
      return false;
    }
  }
  return false;
}

/// AND implicite sur toutes les clés d'une `WhenClause`. Une clause vide
/// (`{}`) est vraie — mais l'ergonomie du registry veut plutôt qu'on omette
/// entièrement `when` pour une règle « toujours active ».
function evaluateWhenClause(clause: WhenClause, payload: FormPayload): boolean {
  for (const [fieldId, cond] of Object.entries(clause)) {
    if (!matchCondition(payload[fieldId], cond)) return false;
  }
  return true;
}

/// Évalue la garde complète d'une règle : `when` (objet déclaratif) AND
/// `whenFn` (fonction). Une règle SANS ni `when` ni `whenFn` est toujours
/// active — utile pour les binds identité systématiques quand le champ
/// source est simplement optionnellement rempli (le `stamp` d'un `bind()`
/// ne stampe rien si la valeur est vide, cf. `bind` plus bas).
export function evaluateWhen(rule: MappingRule, payload: FormPayload): boolean {
  if (rule.when && !evaluateWhenClause(rule.when, payload)) return false;
  if (rule.whenFn && !rule.whenFn(payload)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Résolution des stamps
// ---------------------------------------------------------------------------

/// Applique les règles actives dans l'ordre. Convention `dernier gagnant par
/// widget` : si deux règles ciblent le même widget, la 2ᵉ (la plus tardive
/// dans le tableau) écrase la 1ʳᵉ. Ce contrat rend l'override propre :
///   - `identityBindings(...)` en tête (stamp par défaut) puis
///   - une règle par-formulaire plus bas qui redéfinit le même widget quand
///     la sémantique du formulaire l'exige.
/// La Map préserve l'ordre d'insertion → le filler peut logger les writes
/// dans un ordre déterministe pour le debug.
export function resolveStamps(
  payload: FormPayload,
  rules: readonly MappingRule[]
): Map<string, string | boolean> {
  const out = new Map<string, string | boolean>();
  for (const rule of rules) {
    if (!evaluateWhen(rule, payload)) continue;
    const entries: StampEntry[] = [
      ...(rule.stamp ?? []),
      ...(rule.stampFn ? rule.stampFn(payload) : []),
    ];
    for (const { widget, value } of entries) {
      if (!widget) continue;
      out.set(widget, value);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Helper de composition : `bind`
// ---------------------------------------------------------------------------

export type BindFormat = "date-fr" | "iban-strip-be";

/// Formate une valeur scalaire du payload vers la chaîne à stamper. `null`
/// signifie « ne PAS émettre de stamp » (valeur vide ou incompatible) — le
/// caller drop l'entrée dans ce cas.
function formatValue(value: FieldValue | undefined, format?: BindFormat): string | null {
  if (value === null || value === undefined) return null;
  const raw =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
      ? String(value)
      : null;
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  switch (format) {
    case "date-fr":
      return formatDateFR(trimmed);
    case "iban-strip-be":
      return trimmed.replace(/^\s*[Bb][Ee]\s*/, "").trim();
    default:
      return trimmed;
  }
}

/// Fabrique une `MappingRule` « stampe la valeur de `fieldId` sur `widget`,
/// sauf si vide » avec un nom stable (`bind:<widget>`). Concentre les cas
/// d'identité/adresse/coordonnées où la règle est mécanique ; laisse les
/// cas à logique métier (transfert OP, split IBAN, remarque famille) aux
/// règles explicites du registry.
export function bind(
  fieldId: string,
  widget: string,
  format?: BindFormat
): MappingRule {
  return {
    name: `bind:${widget}`,
    stampFn: (payload) => {
      const formatted = formatValue(payload[fieldId], format);
      if (formatted === null) return [];
      return [{ widget, value: formatted }];
    },
    declaredWidgets: [widget],
  };
}
