import {
  isValidNISS,
  isValidBelgianIBAN,
  isValidBelgianTVA,
  isValidBelgianBCE,
  isValidBelgianPostalCode,
  isValidBelgianPhone,
} from "./validators";

/// Forme normalisée d'un preset utilisable côté client comme côté serveur.
/// Correspond au shape du modèle Prisma `FieldValidationPreset`.
export interface PresetSpec {
  id?: string;
  name?: string;
  fieldType: string;
  regex?: string | null;
  regexFlags?: string | null;
  minLength?: number | null;
  maxLength?: number | null;
  minValue?: number | null;
  maxValue?: number | null;
  minDate?: string | null;
  maxDate?: string | null;
  belgianType?: string | null;
  crossFieldRule?: { type: string; fieldId: string } | null;
  errorMsg: string;
  errorMsgNl?: string | null;
}

/// Dictionnaire de toutes les valeurs du formulaire pour résoudre les références cross-field
/// et les @field_id dans minDate/maxDate.
export type FormValues = Record<string, string | number | boolean | null | undefined>;

function resolveDate(spec: string | null | undefined, formValues: FormValues): Date | null {
  if (!spec) return null;
  if (spec === "today") return new Date(new Date().toISOString().slice(0, 10));
  if (spec.startsWith("@")) {
    const fieldId = spec.slice(1);
    const v = formValues[fieldId];
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return new Date(v.slice(0, 10));
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(spec)) return new Date(spec);
  return null;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/// Valide une valeur selon un preset. Retourne { valid, error? }.
/// `formValues` est utilisé pour les règles cross-field (mustBeAfter, etc.) et @field_id dans dates.
export function validateAgainstPreset(
  value: unknown,
  preset: PresetSpec,
  formValues: FormValues = {},
  lang: "fr" | "nl" = "fr"
): ValidationResult {
  const errMsg = (lang === "nl" && preset.errorMsgNl) || preset.errorMsg;

  // Valeur vide → pas validée par le preset (la validation `required` se fait ailleurs)
  if (value === "" || value === null || value === undefined) {
    return { valid: true };
  }

  const stringValue = String(value);

  // 1. Validateur belge natif (prioritaire)
  if (preset.belgianType) {
    let ok = false;
    switch (preset.belgianType) {
      case "niss":
        ok = isValidNISS(stringValue);
        break;
      case "iban":
        ok = isValidBelgianIBAN(stringValue);
        break;
      case "tva":
        ok = isValidBelgianTVA(stringValue);
        break;
      case "bce":
        ok = isValidBelgianBCE(stringValue);
        break;
      case "postal":
        ok = isValidBelgianPostalCode(stringValue);
        break;
      case "phone":
        ok = isValidBelgianPhone(stringValue);
        break;
      default:
        ok = true;
    }
    if (!ok) return { valid: false, error: errMsg };
  }

  // 2. Regex
  if (preset.regex) {
    try {
      const re = new RegExp(preset.regex, preset.regexFlags || undefined);
      if (!re.test(stringValue)) {
        return { valid: false, error: errMsg };
      }
    } catch {
      // Regex invalide en BDD → ignore (ne casse pas la saisie)
    }
  }

  // 3. Longueur (text/textarea)
  if (preset.minLength != null && stringValue.length < preset.minLength) {
    return { valid: false, error: errMsg };
  }
  if (preset.maxLength != null && stringValue.length > preset.maxLength) {
    return { valid: false, error: errMsg };
  }

  // 4. Valeur numérique
  if (preset.fieldType === "number") {
    const n = typeof value === "number" ? value : parseFloat(stringValue.replace(",", "."));
    if (isNaN(n)) return { valid: false, error: errMsg };
    if (preset.minValue != null && n < preset.minValue) return { valid: false, error: errMsg };
    if (preset.maxValue != null && n > preset.maxValue) return { valid: false, error: errMsg };
  }

  // 5. Date (min/max)
  if (preset.fieldType === "date" && /^\d{4}-\d{2}-\d{2}/.test(stringValue)) {
    const d = new Date(stringValue.slice(0, 10));
    const min = resolveDate(preset.minDate, formValues);
    const max = resolveDate(preset.maxDate, formValues);
    if (min && d < min) return { valid: false, error: errMsg };
    if (max && d > max) return { valid: false, error: errMsg };
  }

  // 6. Cross-field rule
  if (preset.crossFieldRule) {
    const { type, fieldId } = preset.crossFieldRule;
    const other = formValues[fieldId];
    if (other !== undefined && other !== null && other !== "") {
      const a = String(value);
      const b = String(other);
      let ok = true;
      switch (type) {
        case "equals":
          ok = a === b;
          break;
        case "notEquals":
          ok = a !== b;
          break;
        case "after":
          ok = new Date(a) > new Date(b);
          break;
        case "before":
          ok = new Date(a) < new Date(b);
          break;
        case "greaterThan":
          ok = parseFloat(a) > parseFloat(b);
          break;
        case "lessThan":
          ok = parseFloat(a) < parseFloat(b);
          break;
      }
      if (!ok) return { valid: false, error: errMsg };
    }
  }

  return { valid: true };
}
