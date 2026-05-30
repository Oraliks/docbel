import { z, ZodTypeAny } from "zod";
import {
  PdfFormField,
  FormPayload,
  Locale,
  VisibleIf,
  loc,
  DEFAULT_LOCALE,
  isFullNameValue,
} from "./types";
import {
  isValidNISS,
  diagnoseNISS,
  isValidBelgianIBAN,
  isValidBelgianPostalCode,
  isValidBelgianTVA,
  isValidBelgianBCE,
  isValidBelgianPhone,
  isValidEmail,
  isValidISODate,
} from "./validators";

// Messages d'erreur volontairement explicatifs : le public inclut des
// personnes en difficulté de compréhension. On dit QUOI corriger et OÙ
// trouver l'information, avec un exemple concret.
const FALLBACK: Record<string, Record<Locale, string>> = {
  date: {
    fr: "La date n'est pas valide. Indiquez le jour, le mois et l'année (par exemple 31/12/2024).",
    nl: "De datum is niet geldig. Geef de dag, de maand en het jaar op (bijvoorbeeld 31/12/2024).",
    de: "Das Datum ist ungültig. Geben Sie Tag, Monat und Jahr an (zum Beispiel 31.12.2024).",
  },
  niss: {
    fr: "Le numéro NISS n'est pas valide. Vous le trouvez au dos de votre carte d'identité (eID) : 11 chiffres.",
    nl: "Het rijksregisternummer is niet geldig. U vindt het op de achterkant van uw identiteitskaart (eID): 11 cijfers.",
    de: "Die NISS-Nummer ist ungültig. Sie finden sie auf der Rückseite Ihres Personalausweises (eID): 11 Ziffern.",
  },
  iban: {
    fr: "Le numéro de compte (IBAN) n'est pas valide. Un IBAN belge commence par BE suivi de 14 chiffres. Vérifiez-le sur votre carte bancaire ou un extrait de compte.",
    nl: "Het rekeningnummer (IBAN) is niet geldig. Een Belgisch IBAN begint met BE gevolgd door 14 cijfers. Controleer het op uw bankkaart of rekeninguittreksel.",
    de: "Die Kontonummer (IBAN) ist ungültig. Eine belgische IBAN beginnt mit BE, gefolgt von 14 Ziffern. Überprüfen Sie sie auf Ihrer Bankkarte oder einem Kontoauszug.",
  },
  postal_be: {
    fr: "Le code postal n'est pas valide. En Belgique, c'est un nombre entre 1000 et 9999 (par exemple 1000 pour Bruxelles).",
    nl: "De postcode is niet geldig. In België is dat een getal tussen 1000 en 9999 (bijvoorbeeld 1000 voor Brussel).",
    de: "Die Postleitzahl ist ungültig. In Belgien ist das eine Zahl zwischen 1000 und 9999 (zum Beispiel 1000 für Brüssel).",
  },
  tva_be: {
    fr: "Le numéro de TVA n'est pas valide. Il commence par BE suivi de 10 chiffres (par exemple BE 0123.456.789).",
    nl: "Het btw-nummer is niet geldig. Het begint met BE gevolgd door 10 cijfers (bijvoorbeeld BE 0123.456.789).",
    de: "Die MwSt-Nummer ist ungültig. Sie beginnt mit BE, gefolgt von 10 Ziffern (zum Beispiel BE 0123.456.789).",
  },
  bce: {
    fr: "Le numéro d'entreprise (BCE) n'est pas valide. Il comporte 10 chiffres (par exemple 0123.456.789).",
    nl: "Het ondernemingsnummer (KBO) is niet geldig. Het bestaat uit 10 cijfers (bijvoorbeeld 0123.456.789).",
    de: "Die Unternehmensnummer (ZDU) ist ungültig. Sie besteht aus 10 Ziffern (zum Beispiel 0123.456.789).",
  },
  phone_be: {
    fr: "Le numéro de téléphone n'est pas valide. Par exemple : 02 123 45 67 pour un fixe, ou 0470 12 34 56 pour un GSM.",
    nl: "Het telefoonnummer is niet geldig. Bijvoorbeeld: 02 123 45 67 voor een vaste lijn, of 0470 12 34 56 voor een gsm.",
    de: "Die Telefonnummer ist ungültig. Zum Beispiel: 02 123 45 67 für Festnetz oder 0470 12 34 56 für Handy.",
  },
  email: {
    fr: "L'adresse e-mail n'est pas valide. Elle doit contenir un @ et un point, par exemple nom@exemple.be.",
    nl: "Het e-mailadres is niet geldig. Het moet een @ en een punt bevatten, bijvoorbeeld naam@voorbeeld.be.",
    de: "Die E-Mail-Adresse ist ungültig. Sie muss ein @ und einen Punkt enthalten, zum Beispiel name@beispiel.be.",
  },
  format: { fr: "Ce que vous avez saisi n'a pas le bon format.", nl: "Wat u hebt ingevuld heeft niet het juiste formaat.", de: "Ihre Eingabe hat nicht das richtige Format." },
  select: { fr: "Veuillez choisir une valeur dans la liste.", nl: "Kies een waarde uit de lijst.", de: "Bitte wählen Sie einen Wert aus der Liste." },
  required: { fr: "Ce champ est obligatoire, merci de le remplir.", nl: "Dit veld is verplicht, gelieve het in te vullen.", de: "Dieses Feld ist erforderlich, bitte füllen Sie es aus." },
};

// Messages NISS dynamiques : on distingue « pas le bon nombre de chiffres »
// d'une « erreur de frappe » (checksum), car l'action corrective diffère.
const NISS_MESSAGES = {
  length: {
    fr: "Le numéro NISS doit comporter 11 chiffres, mais vous en avez saisi {n}. Vous le trouvez au dos de votre carte d'identité (eID), au-dessus du code-barres.",
    nl: "Het rijksregisternummer moet 11 cijfers bevatten, maar u hebt er {n} ingevuld. U vindt het op de achterkant van uw identiteitskaart (eID), boven de streepjescode.",
    de: "Die NISS-Nummer muss 11 Ziffern enthalten, aber Sie haben {n} eingegeben. Sie finden sie auf der Rückseite Ihres Personalausweises (eID), über dem Strichcode.",
  },
  checksum: {
    fr: "Ce numéro NISS contient probablement une erreur de frappe : les chiffres ne correspondent pas. Vérifiez-le chiffre par chiffre au dos de votre carte d'identité (eID).",
    nl: "Dit rijksregisternummer bevat waarschijnlijk een typefout: de cijfers kloppen niet. Controleer het cijfer voor cijfer op de achterkant van uw identiteitskaart (eID).",
    de: "Diese NISS-Nummer enthält wahrscheinlich einen Tippfehler: Die Ziffern stimmen nicht überein. Überprüfen Sie sie Ziffer für Ziffer auf der Rückseite Ihres Personalausweises (eID).",
  },
} as const;

/// Construit le message NISS adapté à la cause de l'erreur (longueur vs frappe).
/// Un `errorMsg` personnalisé côté admin reste prioritaire (cf. appelant).
export function nissErrorMessage(raw: string, lang: Locale): string {
  const d = diagnoseNISS(raw);
  if (d.reason === "length") {
    return NISS_MESSAGES.length[lang].replace("{n}", String(d.digitCount));
  }
  return NISS_MESSAGES.checksum[lang];
}

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
      // Message dynamique selon la cause (longueur / frappe), sauf si l'admin
      // a défini un message personnalisé qui reste prioritaire.
      return z.string().refine((v) => empty(v) || isValidNISS(v), {
        error: (issue) => loc(field.errorMsg, lang) || nissErrorMessage(String(issue.input ?? ""), lang),
      });
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
    case "fullname":
      // Valeur composite { first, last }. Le format est toujours valide ;
      // l'obligation des deux sous-champs est gérée dans superRefine.
      return z
        .object({ first: z.string().optional(), last: z.string().optional() })
        .or(z.literal("").transform(() => ({ first: "", last: "" })));
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
      // Un champ `fullname` requis exige ses deux sous-parties (prénom + nom).
      const fullNameIncomplete =
        f.type === "fullname" &&
        (!isFullNameValue(v) || !(v.first ?? "").trim() || !(v.last ?? "").trim());
      const isEmpty =
        v === null ||
        v === undefined ||
        (typeof v === "string" && v.trim() === "") ||
        (f.type === "checkbox" && v === false) ||
        fullNameIncomplete;
      if (isEmpty) {
        ctx.addIssue({ code: "custom", path: [f.id], message: errMsg(f, lang, "required") });
      }
    }
  });
}

export { anchoredRegex };
