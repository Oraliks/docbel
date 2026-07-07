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
  isValidInternationalIBAN,
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
  iban_international: {
    fr: "Le numéro de compte (IBAN) n'est pas valide. Vérifiez-le sur votre carte bancaire ou un extrait de compte (ex. FR76 3000 6000 0112 3456 7890 189).",
    nl: "Het rekeningnummer (IBAN) is niet geldig. Controleer het op uw bankkaart of rekeninguittreksel (bijv. FR76 3000 6000 0112 3456 7890 189).",
    de: "Die Kontonummer (IBAN) ist ungültig. Überprüfen Sie sie auf Ihrer Bankkarte oder einem Kontoauszug (z. B. FR76 3000 6000 0112 3456 7890 189).",
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
  number: { fr: "Veuillez saisir un nombre (chiffres uniquement).", nl: "Vul een getal in (alleen cijfers).", de: "Bitte geben Sie eine Zahl ein (nur Ziffern)." },
  requiredGroup: {
    fr: "Sélectionnez au moins une option ci-dessus.",
    nl: "Selecteer minstens één optie hierboven.",
    de: "Wählen Sie mindestens eine der obigen Optionen aus.",
  },
};

// Messages dynamiques pour les contraintes de longueur (texte) et de plage
// (nombre). On insère la valeur attendue avec {n} et la valeur reçue avec {v}.
const LENGTH_MESSAGES = {
  tooShort: {
    fr: "C'est un peu court : il faut au moins {n} caractères (vous en avez écrit {v}).",
    nl: "Dit is een beetje kort: minstens {n} tekens nodig (u hebt er {v} ingevuld).",
    de: "Das ist etwas zu kurz: mindestens {n} Zeichen nötig (Sie haben {v} eingegeben).",
  },
  tooLong: {
    fr: "C'est un peu long : maximum {n} caractères (vous en avez écrit {v}).",
    nl: "Dit is een beetje lang: maximaal {n} tekens (u hebt er {v} ingevuld).",
    de: "Das ist etwas zu lang: maximal {n} Zeichen (Sie haben {v} eingegeben).",
  },
  tooLow: {
    fr: "Le nombre doit être au moins égal à {n}.",
    nl: "Het getal moet minstens {n} zijn.",
    de: "Die Zahl muss mindestens {n} betragen.",
  },
  tooHigh: {
    fr: "Le nombre ne peut pas dépasser {n}.",
    nl: "Het getal mag niet hoger zijn dan {n}.",
    de: "Die Zahl darf nicht höher als {n} sein.",
  },
} as const;

function fmt(template: string, n: string | number, v?: string | number): string {
  let out = template.replace("{n}", String(n));
  if (v !== undefined) out = out.replace("{v}", String(v));
  return out;
}

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
      const customMsg = loc(field.errorMsg, lang);
      const tooLowMsg = customMsg || fmt(LENGTH_MESSAGES.tooLow[lang], field.min ?? 0);
      const tooHighMsg = customMsg || fmt(LENGTH_MESSAGES.tooHigh[lang], field.max ?? 0);
      let n = z.coerce.number({ error: customMsg || FALLBACK.number[lang] });
      if (typeof field.min === "number") n = n.min(field.min, { error: tooLowMsg });
      if (typeof field.max === "number") n = n.max(field.max, { error: tooHighMsg });
      // Important : `z.coerce.number("")` produit `0`, ce qui camouflerait un
      // champ requis vide. On normalise donc la chaîne vide en `null` AVANT la
      // coercition pour que le check "required" du superRefine puisse signaler
      // l'erreur correctement.
      return z.preprocess((v) => (v === "" ? null : v), n.nullable());
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
      // `internationalIban` (opt-in par champ) : le validateur ISO 13616
      // générique (32 pays, déjà écrit) au lieu du strict belge — sert au
      // champ "IBAN étranger" du C1, qui sinon rejetait TOUT IBAN non-belge.
      return field.internationalIban
        ? z.string().refine((v) => empty(v) || isValidInternationalIBAN(v), {
            message: errMsg(field, lang, "iban_international"),
          })
        : z.string().refine((v) => empty(v) || isValidBelgianIBAN(v), { message: errMsg(field, lang, "iban") });
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
    case "signature":
      // La valeur est un data URL PNG. Vide = pas signé. Le check "required"
      // dans superRefine gère le cas "signature manquante". Ici on accepte
      // simplement une chaîne (vide ou data URL).
      return z.string();
    case "array":
      // Champ tableau (cohabitants…). Chaque ligne est un enregistrement de
      // sous-champs (validés séparément par le formulaire — pas de contrôle
      // ligne-par-ligne dans buildValidator). Ici on accepte n'importe quel
      // tableau ; le check "required" du superRefine est intentionnellement
      // NEUTRE pour array (aucun cas array géré dans la boucle) — un tableau
      // vide `[]` ne doit pas bloquer. Sans ce case, on tombait sur z.string()
      // et un `[]` initial côté UI cassait la validation avec un message
      // inutile sur le champ parent (Oraliks 2026-07-07 : « j'ai mis isolé
      // sur le formulaire et j'ai pu aller au next step donc je comprend pas
      // l'erreur » — l'erreur venait d'ici, pas de la visibilité).
      return z.array(z.any());
    case "text":
    case "textarea":
    default: {
      const customMsg = loc(field.errorMsg, lang);
      let s = z.string();
      if (field.minLength) {
        const n = field.minLength;
        s = s.refine((v) => empty(v) || v.length >= n, {
          error: (issue) =>
            customMsg || fmt(LENGTH_MESSAGES.tooShort[lang], n, String(issue.input ?? "").length),
        });
      }
      if (field.maxLength) {
        const n = field.maxLength;
        s = s.refine((v) => v.length <= n, {
          error: (issue) =>
            customMsg || fmt(LENGTH_MESSAGES.tooLong[lang], n, String(issue.input ?? "").length),
        });
      }
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
    case "matchesRegex": {
      // Compilation locale par appel — l'usage attendu est ponctuel (une
      // poignée de visibleIf régex par formulaire). Si un jour on en a des
      // dizaines dans une boucle chaude, on ajoutera un cache LRU côté runner.
      if (typeof cond.value !== "string") return false;
      try {
        return new RegExp(cond.value).test(String(dep ?? ""));
      } catch {
        return false;
      }
    }
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
      // Champs auto-remplis programmatiquement par le runner AVANT la
      // validation (date du jour via `system.today`, signature auto-confirmée
      // dès qu'un nom de signataire est résolu) : leur `required` sert la
      // sémantique côté PDF (le widget existe et doit être stampé) mais ne
      // doit pas bloquer la validation utilisateur si pour une raison
      // quelconque le refill n'a pas eu lieu (draft restauré qui écrase la
      // date, HMR partiel, etc.) — Oraliks 2026-07-07 : "Certains champs
      // sont invalides — Date de signature" persistait alors que la date
      // est censée être générée automatiquement. Le check reste appliqué
      // sur tous les autres required.
      if (f.prefillFrom === "system.today") continue;
      if (f.type === "signature") continue;
      const v = payload[f.id];
      // Un champ `fullname` requis exige ses deux sous-parties (prénom + nom).
      // (Le cas `signature` est court-circuité plus haut — la refill au submit
      // + la ré-injection serveur garantissent que le PDF sera stampé.)
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

    // Contraintes de groupe (`requiredGroup`) : « au moins un des champs
    // partageant cette même clé doit être rempli/coché » — aucun d'eux n'est
    // individuellement `required` (ex. les 5 chips « situation » du C1 :
    // aucune n'est obligatoire seule, mais il en faut au moins une). L'erreur
    // s'attache au PREMIER champ visible du groupe ; le form-runner l'affiche
    // comme message partagé sous tout le groupe de chips (cf. FieldsCluster).
    const groups = new Map<string, PdfFormField[]>();
    for (const f of fields) {
      if (!f.requiredGroup) continue;
      if (!isFieldVisible(f.visibleIf, payload)) continue;
      if (!groups.has(f.requiredGroup)) groups.set(f.requiredGroup, []);
      groups.get(f.requiredGroup)!.push(f);
    }
    for (const groupFields of groups.values()) {
      if (groupFields.length === 0) continue;
      const anySet = groupFields.some((f) => {
        const v = payload[f.id];
        if (f.type === "checkbox") return v === true;
        return typeof v === "string" && v.trim() !== "";
      });
      if (!anySet) {
        const anchor = groupFields[0];
        const message = loc(anchor.errorMsg, lang) || errMsg(anchor, lang, "requiredGroup");
        ctx.addIssue({ code: "custom", path: [anchor.id], message });
      }
    }
  });
}

/// Valide UNIQUEMENT les champs fournis (ex. l'étape courante du stepper),
/// en ignorant le reste du payload — `z.object` est non-strict (clés
/// inconnues simplement ignorées), donc passer le payload COMPLET d'un
/// formulaire à plusieurs étapes est sûr : seuls les champs de `fields`
/// peuvent produire une erreur. Sert à bloquer l'avancée d'étape tant que
/// l'étape courante n'est pas valide (cf. pdf-form-runner.tsx, bouton
/// « Continuer »), avec un message PRÉCIS par champ (pas un message global).
/// Renvoie `{}` si tout est valide.
export function validateStepFields(
  fields: PdfFormField[],
  payload: FormPayload,
  lang: Locale = DEFAULT_LOCALE
): Record<string, string> {
  const result = buildValidator(fields, lang).safeParse(payload);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const id = String(issue.path[0] ?? "");
    if (id && !errors[id]) errors[id] = issue.message;
  }
  return errors;
}

/// Cherche la PREMIÈRE étape invalide parmi une liste (dans l'ordre fourni).
/// Sert à gater un saut d'étape via le stepper : cliquer 2+ crans plus loin
/// doit valider TOUTES les étapes survolées, pas seulement celle qu'on
/// quitte — sinon des étapes intermédiaires (ex. Identité) peuvent être
/// sautées sans jamais être remplies (bug Oraliks, 2026-07-07). Renvoie
/// `null` si toutes les étapes passées sont valides.
export function findFirstInvalidStep(
  stepsFieldsList: PdfFormField[][],
  payload: FormPayload,
  lang: Locale = DEFAULT_LOCALE
): { index: number; errors: Record<string, string> } | null {
  for (let i = 0; i < stepsFieldsList.length; i++) {
    const errors = validateStepFields(stepsFieldsList[i], payload, lang);
    if (Object.keys(errors).length > 0) return { index: i, errors };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Validation par champ (temps réel au blur) + complétion d'étape.
// Réutilise les mêmes validateurs que le schéma Zod, mais pour UN champ, sans
// dépendre du reste du formulaire. Sert au feedback immédiat (✓ vert / erreur
// de format) et au calcul de complétion du stepper.
// ---------------------------------------------------------------------------

/// Forme minimale d'un champ (compatible PdfFormField ET PublicField).
type FieldLike = {
  type: PdfFormField["type"];
  errorMsg?: PdfFormField["errorMsg"];
  nameOrder?: PdfFormField["nameOrder"];
  internationalIban?: PdfFormField["internationalIban"];
};

/// Types dont le format est vérifiable en direct (les autres — text, textarea,
/// select… — n'ont pas de format strict, pas de ✓ automatique).
export const FORMAT_VALIDATABLE_TYPES = new Set<string>([
  "niss", "iban", "date", "email", "phone_be", "postal_be", "tva_be", "bce",
]);

/// Valide le FORMAT d'un champ pour une valeur donnée. Renvoie un message
/// d'erreur si la valeur est non vide ET mal formée, sinon null. Une valeur
/// VIDE renvoie toujours null : l'obligation (champ requis vide) se signale à
/// l'envoi, pas au blur (principe « informatif jamais bloquant »).
export function validateFieldFormat(field: FieldLike, value: unknown, lang: Locale): string | null {
  const v = typeof value === "string" ? value : "";
  if (v.trim() === "") return null;
  const custom = loc(field.errorMsg, lang);
  switch (field.type) {
    case "niss": return isValidNISS(v) ? null : (custom || nissErrorMessage(v, lang));
    case "iban":
      return field.internationalIban
        ? (isValidInternationalIBAN(v) ? null : (custom || FALLBACK.iban_international[lang]))
        : (isValidBelgianIBAN(v) ? null : (custom || FALLBACK.iban[lang]));
    case "date": return isValidISODate(v) ? null : (custom || FALLBACK.date[lang]);
    case "email": return isValidEmail(v) ? null : (custom || FALLBACK.email[lang]);
    case "phone_be": return isValidBelgianPhone(v) ? null : (custom || FALLBACK.phone_be[lang]);
    case "postal_be": return isValidBelgianPostalCode(v) ? null : (custom || FALLBACK.postal_be[lang]);
    case "tva_be": return isValidBelgianTVA(v) ? null : (custom || FALLBACK.tva_be[lang]);
    case "bce": return isValidBelgianBCE(v) ? null : (custom || FALLBACK.bce[lang]);
    default: return null;
  }
}

/// Vrai si le champ est « rempli et valide » — non vide (selon son type) ET de
/// format correct. Sert au compteur de complétion du stepper. Ne tient pas
/// compte de `required`/`visibleIf` (au caller de filtrer).
export function isFieldComplete(field: FieldLike, value: unknown, lang: Locale): boolean {
  if (field.type === "checkbox") return value === true;
  if (field.type === "fullname") {
    if (!isFullNameValue(value)) return false;
    return !!(value.first ?? "").trim() && !!(value.last ?? "").trim();
  }
  if (field.type === "signature") return typeof value === "string" && value.trim() !== "";
  const v = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (v.trim() === "") return false;
  return validateFieldFormat(field, v, lang) === null;
}

export { anchoredRegex };
