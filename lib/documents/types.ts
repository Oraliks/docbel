export type DocumentFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "niss"
  | "iban"
  | "postal_be"
  | "tva_be"
  | "bce"
  | "phone_be"
  | "signature"; // canvas de signature électronique

export interface DocumentFieldOption {
  value: string;
  label: string;
  labelNl?: string;
}

export interface DocumentFieldPosition {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
}

export interface DocumentFieldVisibleIf {
  fieldId: string;
  equals: string | number | boolean;
}

/// Sources possibles de pré-remplissage depuis le profil utilisateur connecté.
/// Étendues en Phase 8 (UserProfile).
export type PrefillSource =
  | "user.name"
  | "user.email"
  | "profile.firstName"
  | "profile.lastName"
  | "profile.niss"
  | "profile.birthDate"
  | "profile.street"
  | "profile.streetNum"
  | "profile.postalCode"
  | "profile.city"
  | "profile.phone"
  | "profile.mobilePhone"
  | "profile.iban"
  | "profile.bic"
  | "profile.employer"
  | "profile.employerBce";

export interface DocumentField {
  id: string;
  pdfFieldName?: string;
  label: string;
  labelNl?: string;
  type: DocumentFieldType;
  required: boolean;

  // Validation directe (override le preset si défini)
  regex?: string;
  errorMsg?: string;
  errorMsgNl?: string;
  maxLength?: number;
  minLength?: number;
  minValue?: number;
  maxValue?: number;

  // Référence vers un FieldValidationPreset (Phase 4)
  presetId?: string;

  // UX
  helpText?: string;
  helpTextNl?: string;
  helpUrl?: string;
  placeholder?: string;
  placeholderNl?: string;

  // Comportement
  defaultValue?: string | number | boolean;
  options?: DocumentFieldOption[];
  visibleIf?: DocumentFieldVisibleIf;
  position?: DocumentFieldPosition;
  prefillFrom?: PrefillSource;
  section?: string;

  // Spécifique au type "signature"
  signatureRequired?: boolean; // si true → bloque la génération sans signature
}

export type DocumentSchema = DocumentField[];

export type DocumentSourceType = "pdf_acroform" | "pdf_flat" | "docx";

export type FieldValue = string | number | boolean | null;

export type GenerationPayload = Record<string, FieldValue>;

export interface ParsedTemplateField {
  field: DocumentField;
}

export interface ParsedTemplate {
  fields: DocumentField[];
  pageCount?: number;
}

export type Lang = "fr" | "nl";

export function getFieldLabel(field: DocumentField, lang: Lang): string {
  if (lang === "nl" && field.labelNl) return field.labelNl;
  return field.label;
}

export function getFieldHelpText(field: DocumentField, lang: Lang): string | undefined {
  if (lang === "nl" && field.helpTextNl) return field.helpTextNl;
  return field.helpText;
}

export function getFieldErrorMsg(field: DocumentField, lang: Lang): string | undefined {
  if (lang === "nl" && field.errorMsgNl) return field.errorMsgNl;
  return field.errorMsg;
}

export function getOptionLabel(opt: DocumentFieldOption, lang: Lang): string {
  if (lang === "nl" && opt.labelNl) return opt.labelNl;
  return opt.label;
}
