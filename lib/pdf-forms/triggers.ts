// Évaluation des déclencheurs de sous-formulaires portés par un PdfForm.
//
// Architecture : chaque PdfForm porte une liste `triggers: PdfFormTrigger[]`.
// Quand le payload de ce form satisfait un trigger, le slug du formulaire
// cible est ajouté au parcours utilisateur. Le runtime côté
// app/d/[slug]/page.tsx collecte tous les payloads complétés,
// appelle `collectTriggeredSlugs` pour chaque PdfForm, déduplique, et
// matérialise les items virtuels supplémentaires au rendu.

import type { FormPayload, PdfFormTrigger } from "./types";

/// Compare deux valeurs façon « égalité utilisateur » : casse-tolérante
/// pour les strings, stricte pour le reste. Évite les pièges genre
/// `"oui" !== "OUI"` quand un payload provient d'un import en majuscules.
function looseEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase().trim() === b.toLowerCase().trim();
  }
  // Boolean ↔ string ("true"/"false") : fréquent quand un Json.parse renvoie
  // un boolean alors qu'on en attendait un string ou vice-versa.
  if (typeof a === "boolean" && typeof b === "string") return String(a) === b.toLowerCase();
  if (typeof a === "string" && typeof b === "boolean") return a.toLowerCase() === String(b);
  return false;
}

/// Lit un champ du payload en supportant la notation `field[*].sub` qui
/// renvoie la liste des valeurs `sub` de toutes les lignes du tableau `field`.
/// Pour les chemins plats classiques (`"foo"`), renvoie la valeur unique
/// dans un tableau de 1 élément (uniformisation côté caller).
function readFieldPath(payload: FormPayload, path: string): unknown[] {
  const arrayMatch = path.match(/^([^[]+)\[\*\]\.(.+)$/);
  if (!arrayMatch) {
    const v = payload[path];
    return v === undefined ? [] : [v];
  }
  const [, arrayField, subField] = arrayMatch;
  const rows = payload[arrayField];
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => (r as Record<string, unknown>)[subField]).filter((v) => v !== undefined);
}

/// Évalue un trigger contre un payload. Renvoie true si le trigger doit
/// matérialiser son `requiresFormSlug`.
///
/// Supporte la notation tableau `whenFieldId: "cohabitants[*].lien"` : le
/// trigger se déclenche si AU MOINS UNE ligne satisfait la règle.
export function evaluateTrigger(trigger: PdfFormTrigger, payload: FormPayload): boolean {
  const whenValues = readFieldPath(payload, trigger.whenFieldId);
  const whenMatched = whenValues.some(
    (v) => v !== null && v !== undefined && looseEquals(v, trigger.whenValue)
  );
  if (!whenMatched) return false;

  // Exclusion : si le champ d'exclusion est égal à la valeur d'exclusion,
  // le trigger ne se déclenche pas. Permet de modéliser le follow-up
  // « déjà déclaré ? » qui annule le besoin du sous-formulaire.
  if (trigger.unlessFieldId) {
    const unlessValues = readFieldPath(payload, trigger.unlessFieldId);
    const unlessMatched = unlessValues.some(
      (v) => v !== null && v !== undefined && looseEquals(v, trigger.unlessValue)
    );
    if (unlessMatched) return false;
  }
  return true;
}

/// Collecte les slugs de PdfForms requis par les triggers d'un formulaire.
/// Renvoie un tableau dédupliqué (un même slug peut être cible de plusieurs
/// triggers — eg. C1A est ajouté quel que soit le déclencheur parmi trois).
export function collectTriggeredSlugs(
  triggers: PdfFormTrigger[],
  payload: FormPayload
): string[] {
  const out = new Set<string>();
  for (const t of triggers) {
    if (evaluateTrigger(t, payload)) out.add(t.requiresFormSlug);
  }
  return [...out];
}

/// Récupère les triggers actifs (avec leur raison localisée) pour un payload
/// donné. Utile pour afficher côté UI « Tu dois aussi compléter X parce que … ».
export function activeTriggers(
  triggers: PdfFormTrigger[],
  payload: FormPayload
): PdfFormTrigger[] {
  return triggers.filter((t) => evaluateTrigger(t, payload));
}

/// Parse un tableau JSON brut (depuis la DB) en `PdfFormTrigger[]` sécurisé.
/// Ignore les éléments mal formés sans crasher.
export function parseTriggers(raw: unknown): PdfFormTrigger[] {
  if (!Array.isArray(raw)) return [];
  const out: PdfFormTrigger[] = [];
  for (const item of raw) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as { whenFieldId?: unknown }).whenFieldId !== "string" ||
      typeof (item as { requiresFormSlug?: unknown }).requiresFormSlug !== "string"
    ) continue;
    const t = item as Record<string, unknown>;
    const trigger: PdfFormTrigger = {
      whenFieldId: t.whenFieldId as string,
      whenValue: t.whenValue as PdfFormTrigger["whenValue"],
      requiresFormSlug: t.requiresFormSlug as string,
    };
    if (typeof t.unlessFieldId === "string") {
      trigger.unlessFieldId = t.unlessFieldId;
      trigger.unlessValue = t.unlessValue as PdfFormTrigger["unlessValue"];
    }
    if (typeof t.reason === "object" && t.reason !== null) {
      trigger.reason = t.reason as PdfFormTrigger["reason"];
    }
    out.push(trigger);
  }
  return out;
}
