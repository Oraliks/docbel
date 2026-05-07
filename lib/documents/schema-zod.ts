import { z, ZodTypeAny } from "zod";
import {
  DocumentField,
  DocumentSchema,
  GenerationPayload,
  Lang,
  getFieldErrorMsg,
  getFieldLabel,
} from "./types";
import {
  isValidNISS,
  isValidBelgianIBAN,
  isValidBelgianPostalCode,
  isValidISODate,
  isValidBelgianTVA,
  isValidBelgianBCE,
  isValidBelgianPhone,
} from "./validators";

const FALLBACK_MSG: Record<string, Record<Lang, string>> = {
  date: {
    fr: "Date invalide (attendu YYYY-MM-DD)",
    nl: "Ongeldige datum (verwacht YYYY-MM-DD)",
  },
  niss: {
    fr: "Numéro NISS invalide",
    nl: "Ongeldig rijksregisternummer",
  },
  iban: { fr: "IBAN belge invalide", nl: "Ongeldig Belgisch IBAN" },
  postal_be: {
    fr: "Code postal belge invalide (1000-9999)",
    nl: "Ongeldige Belgische postcode (1000-9999)",
  },
  tva_be: { fr: "Numéro de TVA belge invalide", nl: "Ongeldig Belgisch BTW-nummer" },
  bce: {
    fr: "Numéro d'entreprise BCE invalide",
    nl: "Ongeldig KBO-ondernemingsnummer",
  },
  phone_be: {
    fr: "Numéro de téléphone belge invalide",
    nl: "Ongeldig Belgisch telefoonnummer",
  },
  format: { fr: "Format invalide", nl: "Ongeldig formaat" },
  select: { fr: "Valeur non autorisée", nl: "Niet-toegestane waarde" },
};

function msg(field: DocumentField, lang: Lang, fallbackKey: keyof typeof FALLBACK_MSG): string {
  return getFieldErrorMsg(field, lang) || FALLBACK_MSG[fallbackKey][lang];
}

function fieldToZod(field: DocumentField, lang: Lang): ZodTypeAny {
  switch (field.type) {
    case "checkbox":
      return z.coerce.boolean();
    case "number":
      return z.coerce.number().or(z.literal("").transform(() => null));
    case "date":
      return z.string().refine((v) => v === "" || isValidISODate(v), {
        message: msg(field, lang, "date"),
      });
    case "niss":
      return z.string().refine((v) => v === "" || isValidNISS(v), {
        message: msg(field, lang, "niss"),
      });
    case "iban":
      return z.string().refine((v) => v === "" || isValidBelgianIBAN(v), {
        message: msg(field, lang, "iban"),
      });
    case "postal_be":
      return z.string().refine((v) => v === "" || isValidBelgianPostalCode(v), {
        message: msg(field, lang, "postal_be"),
      });
    case "tva_be":
      return z.string().refine((v) => v === "" || isValidBelgianTVA(v), {
        message: msg(field, lang, "tva_be"),
      });
    case "bce":
      return z.string().refine((v) => v === "" || isValidBelgianBCE(v), {
        message: msg(field, lang, "bce"),
      });
    case "phone_be":
      return z.string().refine((v) => v === "" || isValidBelgianPhone(v), {
        message: msg(field, lang, "phone_be"),
      });
    case "select": {
      const allowed = (field.options || []).map((o) => o.value);
      if (allowed.length === 0) return z.string();
      return z.string().refine((v) => v === "" || allowed.includes(v), {
        message: msg(field, lang, "select"),
      });
    }
    case "text":
    case "textarea":
    default: {
      let s = z.string();
      if (field.maxLength) s = s.max(field.maxLength);
      if (field.regex) {
        try {
          const rx = new RegExp(field.regex);
          s = s.refine((v) => v === "" || rx.test(v), {
            message: msg(field, lang, "format"),
          });
        } catch {
          // regex invalide côté admin → on ignore silencieusement
        }
      }
      return s;
    }
  }
}

export function isFieldVisible(field: DocumentField, payload: GenerationPayload): boolean {
  if (!field.visibleIf) return true;
  const dep = payload[field.visibleIf.fieldId];
  return dep === field.visibleIf.equals;
}

export function buildPayloadValidator(schema: DocumentSchema, lang: Lang = "fr") {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of schema) {
    shape[f.id] = fieldToZod(f, lang).optional();
  }
  return z.object(shape).superRefine((data, ctx) => {
    for (const f of schema) {
      if (!f.required) continue;
      if (!isFieldVisible(f, data as GenerationPayload)) continue;
      const v = (data as GenerationPayload)[f.id];
      const isEmpty =
        v === null ||
        v === undefined ||
        (typeof v === "string" && v.trim() === "") ||
        (f.type === "checkbox" && v === false);
      if (isEmpty) {
        ctx.addIssue({
          code: "custom",
          path: [f.id],
          message:
            getFieldErrorMsg(f, lang) ||
            (lang === "nl"
              ? `Het veld "${getFieldLabel(f, lang)}" is verplicht`
              : `Le champ « ${getFieldLabel(f, lang)} » est obligatoire`),
        });
      }
    }
  });
}
