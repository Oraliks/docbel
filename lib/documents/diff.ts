import { DocumentField } from "./types";

export interface SchemaDiff {
  added: Array<{ id: string; label: string; type: string }>;
  removed: Array<{ id: string; label: string; type: string }>;
  modified: Array<{
    id: string;
    label: string;
    changes: Array<{ key: string; from: unknown; to: unknown }>;
  }>;
  /// Récap "{2 ajoutés, 1 supprimé, 3 modifiés}"
  summary: string;
}

const COMPARED_KEYS: (keyof DocumentField)[] = [
  "label",
  "labelNl",
  "type",
  "required",
  "regex",
  "errorMsg",
  "errorMsgNl",
  "helpText",
  "helpTextNl",
  "helpUrl",
  "defaultValue",
  "options",
  "visibleIf",
  "position",
  "maxLength",
  "minLength",
  "minValue",
  "maxValue",
  "prefillFrom",
  "section",
  "presetId",
  "placeholder",
  "placeholderNl",
  "signatureRequired",
];

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function computeSchemaDiff(
  oldFields: DocumentField[],
  newFields: DocumentField[]
): SchemaDiff {
  const oldMap = new Map(oldFields.map((f) => [f.id, f]));
  const newMap = new Map(newFields.map((f) => [f.id, f]));

  const added: SchemaDiff["added"] = [];
  const removed: SchemaDiff["removed"] = [];
  const modified: SchemaDiff["modified"] = [];

  // Added
  for (const [id, field] of newMap) {
    if (!oldMap.has(id)) {
      added.push({ id, label: field.label, type: field.type });
    }
  }

  // Removed
  for (const [id, field] of oldMap) {
    if (!newMap.has(id)) {
      removed.push({ id, label: field.label, type: field.type });
    }
  }

  // Modified
  for (const [id, newField] of newMap) {
    const oldField = oldMap.get(id);
    if (!oldField) continue;
    const changes: Array<{ key: string; from: unknown; to: unknown }> = [];
    for (const key of COMPARED_KEYS) {
      const from = oldField[key];
      const to = newField[key];
      if (!deepEqual(from, to)) {
        changes.push({ key, from, to });
      }
    }
    if (changes.length > 0) {
      modified.push({ id, label: newField.label, changes });
    }
  }

  const parts: string[] = [];
  if (added.length) parts.push(`${added.length} ajouté${added.length > 1 ? "s" : ""}`);
  if (removed.length) parts.push(`${removed.length} supprimé${removed.length > 1 ? "s" : ""}`);
  if (modified.length) parts.push(`${modified.length} modifié${modified.length > 1 ? "s" : ""}`);

  return {
    added,
    removed,
    modified,
    summary: parts.length > 0 ? parts.join(", ") : "Aucun changement",
  };
}
