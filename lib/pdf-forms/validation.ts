import { z, ZodTypeAny } from "zod";
import {
  PdfFormField,
  FormPayload,
  Locale,
  VisibleIf,
  loc,
  DEFAULT_LOCALE,
} from "./types";
import {
  isValidNISS,
  isValidBelgianIBAN,
  isValidBelgianPostalCode,
  isValidBelgianTVA,
  isValidBelgianBCE,
  isValidBelgianPhone,
  isValidEmail,
  isValidISODate,
} from "./validators";

const FALLBACK: Record<string, Record<Locale, string>> = {
  date: { fr: "Date invalide (AAAA-MM-JJ)", nl: "Ongeldige datum (JJJJ-MM-DD)", de: "Ungültiges Datum (JJJJ-MM-TT)" },
  niss: { fr: "Numéro NISS invalide", nl: "Ongeldig rijksregisternummer", de: "Ungültige NISS-Nummer" },
  iban: { fr: "IBAN belge invalide", nl: "Ongeldig Belgisch IBAN", de: "Ungültige belgische IBAN" },
  postal_be: { fr: "Code postal invalide (1000-9999)", nl: "Ongeldige postcode (1000-9999)", de: "Ungültige Postleitzahl (1000-9999)" },
  tva_be: { fr: "Numéro de TVA invalide", nl: "Ongeldig btw-nummer", de: "Ungültige MwSt-Nummer" },
  bce: { fr: "Numéro BCE invalide", nl: "Ongeldig KBO-nummer", de: "Ungültige ZDU-Nummer" },
  phone_be: { fr: "Numéro de téléphone invalide", nl: "Ongeldig telefoonnummer", de: "Ungültige Telefonnummer" },
  email: { fr: "Adresse e-mail invalide", nl: "Ongeldig e-mailadres", de: "Ungültige E-Mail-Adresse" },
  format: { fr: "Format invalide", nl: "Ongeldig formaat", de: "Ungültiges Format" },
  select: { fr: "Valeur non autorisée", nl: "Niet-toegestane waarde", de: "Unzulässiger Wert" },
  required: { fr: "Ce champ est obligatoire", nl: "Dit veld is verplicht", de: "Dieses Feld ist erforderlich" },
};

function errMsg(field: PdfFormField, lang: Locale, key: keyof typeof FALLBACK): string {
  return loc(field.errorMsg, lang) || FALLBACK[key][lang] || FALLBACK[key][DEFAULT_LOCALE];
}

/// Compile une regex admin en version ANCRÉE (^...$) pour éviter les
/// validations partielles trompeuses. Renvoie null si la regex est invalide.
function anchoredRegex(pattern: string): RegExp | null {
  try {
    const body = pattern.replace(/^\^/, "").replace(/\$$/, "");
    return new RegExp(`^(?:${body})$`);
  } catch {
    return null;
  }
}

function fieldToZod(field: PdfFormField, lang: Locale): ZodTypeAny {
  const empty = (v: string) => v === "";
  switch (field.type) {
    case "checkbox":
      return z.coerce.boolean();
    case "number": {
      let n = z.coerce.number();
      if (typeof field.min === "number") n = n.min(field.min);
      if (typeof field.max === "number") n = n.max(field.max);
      return n.or(z.literal("").transform(() => null));
    }
    case "date":
      return z.string().refine((v) => empty(v) || isValidISODate(v), { message: errMsg(field, lang, "date") });
    case "niss":
      return z.string().refine((v) => empty(v) || isValidNISS(v), { message: errMsg(field, lang, "niss") });
    case "iban":
      return z.string().refine((v) => empty(v) || isValidBelgianIBAN(v), { message: errMsg(field, lang, "iban") });
    case "postal_be":
      return z.string().refine((v) => empty(v) || isValidBelgianPostalCode(v), { message: errMsg(field, lang, "postal_be") });
    case "tva_be":
      return z.string().refine((v) => empty(v) || isValidBelgianTVA(v), { message: errMsg(field, lang, "tva_be") });
    case "bce":
      return z.string().refine((v) => empty(v) || isValidBelgianBCE(v), { message: errMsg(field, lang, "bce") });
    case "phone_be":
      return z.string().refine((v) => empty(v) || isValidBelgianPhone(v), { message: errMsg(field, lang, "phone_be") });
    case "email":
      return z.string().refine((v) => empty(v) || isValidEmail(v), { message: errMsg(field, lang, "email") });
    case "select":
    case "radio": {
      const allowed = (field.options || []).map((o) => o.value);
      if (!allowed.length) return z.string();
      return z.string().refine((v) => empty(v) || allowed.includes(v), { message: errMsg(field, lang, "select") });
    }
    case "text":
    case "textarea":
    default: {
      let s = z.string();
      if (field.maxLength) s = s.max(field.maxLength);
      if (field.minLength) s = s.min(field.minLength);
      if (field.regex) {
        const rx = anchoredRegex(field.regex);
        if (rx) s = s.refine((v) => empty(v) || rx.test(v), { message: errMsg(field, lang, "format") });
      }
      return s;
    }
  }
}

/// Évalue la visibilité d'un champ selon `visibleIf`.
export function isFieldVisible(cond: VisibleIf | undefined, payload: FormPayload): boolean {
  if (!cond) return true;
  const dep = payload[cond.fieldId];
  switch (cond.op) {
    case "equals":
      return dep === cond.value;
    case "notEquals":
      return dep !== cond.value;
    case "in":
      return Array.isArray(cond.value) && cond.value.includes(dep as string | number);
    case "notIn":
      return Array.isArray(cond.value) && !cond.value.includes(dep as string | number);
    default:
      return true;
  }
}

/// Construit le validateur Zod d'un formulaire pour une locale donnée.
/// Les champs requis ne sont vérifiés que s'ils sont visibles.
export function buildValidator(fields: PdfFormField[], lang: Locale = DEFAULT_LOCALE) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of fields) shape[f.id] = fieldToZod(f, lang).optional();

  return z.object(shape).superRefine((data, ctx) => {
    const payload = data as FormPayload;
    for (const f of fields) {
      if (!f.required) continue;
      if (!isFieldVisible(f.visibleIf, payload)) continue;
      const v = payload[f.id];
      const isEmpty =
        v === null ||
        v === undefined ||
        (typeof v === "string" && v.trim() === "") ||
        (f.type === "checkbox" && v === false);
      if (isEmpty) {
        ctx.addIssue({ code: "custom", path: [f.id], message: errMsg(f, lang, "required") });
      }
    }
  });
}

export { anchoredRegex };
