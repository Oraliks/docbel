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
  | "phone_be";

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

export type PrefillSource = "user.name" | "user.email";

export interface DocumentField {
  id: string;
  pdfFieldName?: string;
  label: string;
  labelNl?: string;
  type: DocumentFieldType;
  required: boolean;
  regex?: string;
  errorMsg?: string;
  errorMsgNl?: string;
  helpText?: string;
  helpTextNl?: string;
  helpUrl?: string;
  defaultValue?: string | number | boolean;
  options?: DocumentFieldOption[];
  visibleIf?: DocumentFieldVisibleIf;
  position?: DocumentFieldPosition;
  maxLength?: number;
  prefillFrom?: PrefillSource;
  section?: string;
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
