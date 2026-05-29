/// Types du sous-module "éditeur visuel d'AcroForms" du module PDF Forms.
///
/// Le wrapper VisualFieldsDoc est stocké tel quel dans PdfForm.visualFields
/// (Json). Le versioning du wrapper sert à migrer un éventuel format v2 plus
/// tard sans casser les fiches existantes.
///
/// v1 — strict : seuls les types `text` et `checkbox` sont supportés. Pas de
/// rotation de page. Pas de PDF avec AcroForm existant.

export type VisualFieldType = "text" | "checkbox";

/// Rectangle d'un widget en coordonnées PDF user-space (points, origine
/// bas-gauche). Inclut l'offset de la CropBox si présent — c'est la même
/// convention que `PdfRect` dans lib/pdf-canvas/coords.
export interface VisualFieldRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface VisualFieldBase {
  /// Identifiant interne stable (nanoid). Sert de clé React. Distinct du
  /// nom AcroForm matérialisé.
  id: string;
  /// Index de page 0-based.
  page: number;
  /// Nom du champ PDF — devra être unique dans le doc. Validé via
  /// validation.ts (regex stricte v1).
  name: string;
  rect: VisualFieldRect;
  /// Tooltip /TU. Stocké brut (Unicode). Optionnel.
  tooltip?: string;
  required?: boolean;
  readOnly?: boolean;
}

export interface VisualTextField extends VisualFieldBase {
  type: "text";
  /// /MaxLen — longueur max. v1 : entier positif sinon ignoré.
  maxLen?: number;
  /// Flag /Ff bit 13 — texte multiligne.
  multiline?: boolean;
  defaultValue?: string;
}

export interface VisualCheckboxField extends VisualFieldBase {
  type: "checkbox";
  defaultChecked?: boolean;
}

export type VisualField = VisualTextField | VisualCheckboxField;

export interface VisualFieldsDoc {
  version: 1;
  fields: VisualField[];
  /// Noms des champs créés lors de la dernière matérialisation. Permet de les
  /// supprimer avant une re-matérialisation (cf. cleanup-orphans.ts).
  materializedNames?: string[];
}

/// Default doc renvoyé quand la colonne BDD est vide.
export const EMPTY_DOC: VisualFieldsDoc = { version: 1, fields: [] };

/// Parse une valeur lue depuis PdfForm.visualFields (Json Prisma) en doc
/// strict. Renvoie EMPTY_DOC si null/vide ou format inconnu.
export function parseVisualFieldsDoc(raw: unknown): VisualFieldsDoc {
  if (!raw || typeof raw !== "object") return EMPTY_DOC;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1 || !Array.isArray(r.fields)) return EMPTY_DOC;
  const fields = (r.fields as unknown[]).filter(isLikelyField) as VisualField[];
  const materializedNames = Array.isArray(r.materializedNames)
    ? (r.materializedNames as unknown[]).filter((s): s is string => typeof s === "string")
    : undefined;
  return { version: 1, fields, materializedNames };
}

function isLikelyField(v: unknown): boolean {
  if (!v || typeof v !== "object") return false;
  const f = v as Record<string, unknown>;
  if (typeof f.id !== "string" || typeof f.name !== "string") return false;
  if (typeof f.page !== "number") return false;
  if (f.type !== "text" && f.type !== "checkbox") return false;
  const r = f.rect as Record<string, unknown> | undefined;
  if (!r || typeof r.x !== "number" || typeof r.y !== "number" || typeof r.w !== "number" || typeof r.h !== "number") return false;
  return true;
}

/// Serialize un doc pour Prisma (les `undefined` doivent être absents en JSON).
export function serializeVisualFieldsDoc(doc: VisualFieldsDoc): unknown {
  return JSON.parse(JSON.stringify(doc));
}
