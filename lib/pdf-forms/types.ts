// Types du module PDF Forms (AcroForm only). Indépendant de lib/documents.

/// Locales officielles belges supportées. FR est toujours présent.
export type Locale = "fr" | "nl" | "de";
export const LOCALES: Locale[] = ["fr", "nl", "de"];
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(v: unknown): v is Locale {
  return v === "fr" || v === "nl" || v === "de";
}

/// Contenu localisé. La clé `fr` est la référence ; nl/de sont optionnelles.
export type Localized = Partial<Record<Locale, string>>;

/// Résout un texte localisé avec repli sur la locale par défaut puis FR.
export function loc(
  value: Localized | undefined,
  lang: Locale,
  fallback: Locale = DEFAULT_LOCALE
): string {
  if (!value) return "";
  return value[lang] ?? value[fallback] ?? value.fr ?? "";
}

// ---------------------------------------------------------------------------
// Niveau technique : extraction brute de l'AcroForm (ancre immuable).
// ---------------------------------------------------------------------------

export type AcroFieldType = "text" | "checkbox" | "dropdown" | "radio" | "unknown";

export interface AcroFieldRaw {
  /// Nom exact du champ dans le PDF (clé de remplissage — NE PAS modifier).
  pdfFieldName: string;
  acroType: AcroFieldType;
  /// Tooltip PDF (clé /TU) — souvent un libellé lisible exploitable.
  tooltip?: string;
  /// Longueur max imposée par le PDF (/MaxLen).
  maxLen?: number;
  /// Valeur par défaut du PDF (/DV).
  defaultValue?: string;
  /// Options pour dropdown/radio (/Opt ou valeurs d'export).
  options?: string[];
  readOnly?: boolean;
  required?: boolean;
  multiline?: boolean;
  /// Index de page (0-based) du premier widget rattaché au champ.
  page?: number;
  /// Rectangle du widget [x, y, w, h] en points PDF — utile au regroupement.
  rect?: [number, number, number, number];
}

// ---------------------------------------------------------------------------
// Niveau enrichi : ce que l'admin édite et ce que le front consomme.
// ---------------------------------------------------------------------------

/// Type sémantique d'un champ (validation/UX). Étend les types AcroForm bruts.
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "radio"
  | "fullname"
  | "niss"
  | "iban"
  | "postal_be"
  | "tva_be"
  | "bce"
  | "phone_be"
  | "email";

export const SEMANTIC_FIELD_TYPES: FieldType[] = [
  "text", "textarea", "number", "date", "checkbox", "select", "radio",
  "fullname", "niss", "iban", "postal_be", "tva_be", "bce", "phone_be", "email",
];

/// Libellés lisibles (FR) pour le sélecteur de type côté admin. Le public ne
/// voit jamais ces libellés (il voit le `label` du champ) — c'est uniquement
/// pour que l'admin reconnaisse chaque type sans connaître l'anglais.
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texte (court)",
  textarea: "Texte (long, multiligne)",
  number: "Nombre",
  date: "Date",
  checkbox: "Case à cocher",
  select: "Liste déroulante",
  radio: "Boutons radio",
  fullname: "Nom complet (Prénom + Nom)",
  niss: "NISS (registre national)",
  iban: "IBAN (compte bancaire)",
  postal_be: "Code postal (Belgique)",
  tva_be: "Numéro de TVA",
  bce: "Numéro d'entreprise (BCE)",
  phone_be: "Téléphone (Belgique)",
  email: "Adresse e-mail",
};

/// Ordre d'assemblage d'un champ `fullname` (deux sous-champs côté front,
/// un seul champ texte côté PDF).
export type NameOrder = "first-last" | "last-first";

/// Source de pré-remplissage. `itsme.*` = claims OIDC itsme ;
/// `profile.*` = profil utilisateur connecté.
export type PrefillSource =
  | "system.today"
  | "itsme.firstName"
  | "itsme.lastName"
  | "itsme.niss"
  | "itsme.birthDate"
  | "itsme.gender"
  | "itsme.street"
  | "itsme.postalCode"
  | "itsme.city"
  | "profile.firstName"
  | "profile.lastName"
  | "profile.niss"
  | "profile.email"
  | "profile.phone"
  | "profile.iban"
  | "profile.street"
  | "profile.postalCode"
  | "profile.city";

export type ConditionOp = "equals" | "notEquals" | "in" | "notIn";

export interface VisibleIf {
  fieldId: string;
  op: ConditionOp;
  /// Pour equals/notEquals : valeur scalaire ; pour in/notIn : tableau.
  value: string | number | boolean | Array<string | number>;
}

export interface FieldOption {
  value: string;
  label: Localized;
}

export interface PdfFormField {
  /// Identifiant stable côté schéma enrichi (slug). Distinct de pdfFieldName.
  id: string;
  /// Ancre vers l'AcroForm. Vide si champ purement logique (rare).
  pdfFieldName: string;
  type: FieldType;
  required: boolean;

  // Contenu localisé
  label: Localized;
  help?: Localized;
  placeholder?: Localized;
  errorMsg?: Localized;
  options?: FieldOption[];

  // Validation
  presetKey?: string;
  /// Regex appliquée ANCRÉE (^...$) à la validation.
  regex?: string;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;

  // Comportement / UX
  defaultValue?: string | number | boolean;
  visibleIf?: VisibleIf;
  prefillFrom?: PrefillSource;
  /// Pour les champs `fullname` : ordre d'assemblage des deux sous-champs.
  /// Défaut "first-last" (Prénom Nom).
  nameOrder?: NameOrder;
  /// Regroupement visuel ("identite", "adresse", "employeur"…).
  section?: string;
  order?: number;

  // Méta technique (non exposée au public)
  /// Note interne admin — JAMAIS exposée côté public.
  internalNote?: string;
  acroType?: AcroFieldType;
  readOnly?: boolean;
}

/// Valeur d'un champ `fullname` : deux sous-parties éditées côté front,
/// fusionnées en une seule chaîne au remplissage du PDF.
export interface FullNameValue {
  first?: string;
  last?: string;
}

export type FieldValue = string | number | boolean | null | FullNameValue;
export type FormPayload = Record<string, FieldValue>;

/// Garde de type pour distinguer une valeur composite `fullname`.
export function isFullNameValue(v: unknown): v is FullNameValue {
  return typeof v === "object" && v !== null && !Array.isArray(v) && ("first" in v || "last" in v);
}

export interface ParsedPdf {
  fields: AcroFieldRaw[];
  pageCount: number;
  /// true si le PDF a au moins un champ AcroForm.
  hasAcroForm: boolean;
}
