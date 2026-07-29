import { z, ZodTypeAny } from "zod";
import {
  PdfFormField,
  FormPayload,
  FieldValueRecord,
  Locale,
  VisibleIf,
  loc,
  DEFAULT_LOCALE,
  isFullNameValue,
  isFieldValueRecordArray,
} from "./types";
import { isAutoField } from "./auto-fields";
import {
  isValidNISS,
  diagnoseNISS,
  nissBlocking,
  isValidBelgianIBAN,
  isValidInternationalIBAN,
  isValidBelgianPostalCode,
  isValidBelgianTVA,
  isValidBelgianBCE,
  diagnoseBCE,
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
  date: {
    fr: "La date encodée dans ce NISS est impossible (mois ou jour hors limites). As-tu inversé l'ordre année / mois / jour ? Recopie-le exactement depuis ta carte d'identité (eID).",
    nl: "De datum in dit rijksregisternummer is onmogelijk (maand of dag buiten bereik). Heb je de volgorde jaar / maand / dag verwisseld? Neem het exact over van je identiteitskaart (eID).",
    de: "Das in dieser NISS-Nummer kodierte Datum ist unmöglich (Monat oder Tag außerhalb des Bereichs). Hast du die Reihenfolge Jahr / Monat / Tag vertauscht? Übernimm sie genau von deinem Personalausweis (eID).",
  },
  checksum: {
    fr: "Ce numéro NISS contient probablement une erreur de frappe : les chiffres ne correspondent pas. Vérifiez-le chiffre par chiffre au dos de votre carte d'identité (eID).",
    nl: "Dit rijksregisternummer bevat waarschijnlijk een typefout: de cijfers kloppen niet. Controleer het cijfer voor cijfer op de achterkant van uw identiteitskaart (eID).",
    de: "Diese NISS-Nummer enthält wahrscheinlich einen Tippfehler: Die Ziffern stimmen nicht überein. Überprüfen Sie sie Ziffer für Ziffer auf der Rückseite Ihres Personalausweises (eID).",
  },
} as const;

/// Construit le message NISS adapté à la cause (longueur / date impossible /
/// frappe). Un `errorMsg` personnalisé côté admin reste prioritaire (appelant).
export function nissErrorMessage(raw: string, lang: Locale): string {
  const d = diagnoseNISS(raw);
  if (d.reason === "length") {
    return NISS_MESSAGES.length[lang].replace("{n}", String(d.digitCount));
  }
  if (d.reason === "date") {
    return NISS_MESSAGES.date[lang];
  }
  return NISS_MESSAGES.checksum[lang];
}

/// Forme commune des dictionnaires de messages BCE/TVA (une entrée par cause
/// de rejet de `diagnoseBCE`, chacune traduite fr/nl/de).
type BceMessageSet = {
  length: Record<Locale, string>;
  leadingDigit: Record<Locale, string>;
  checksum: Record<Locale, string>;
};

// Messages BCE dynamiques : on distingue « pas le bon nombre de chiffres »,
// « premier chiffre invalide » (0 ou 1 uniquement) et « erreur de frappe »
// (checksum) — ce dernier cas est le PLUS TROMPEUR : le numéro est bien formé
// mais ne correspond à aucune entreprise, alors que l'utilisateur est
// persuadé d'avoir raison (cf. rapport Oraliks 2026-07-29 : 2189388879 refusé
// avec un message qui ne parlait que de la longueur, alors que ce numéro
// comporte bien 10 chiffres — le vrai problème est le premier chiffre).
const BCE_MESSAGES: BceMessageSet = {
  length: {
    fr: "Le numéro d'entreprise (BCE) doit comporter 10 chiffres, mais vous en avez saisi {n}. Vous le trouvez sur un extrait de la Banque-Carrefour des Entreprises ou sur vos documents d'entreprise (par exemple 0123.456.789).",
    nl: "Het ondernemingsnummer (KBO) moet 10 cijfers bevatten, maar u hebt er {n} ingevuld. U vindt het op een uittreksel van de Kruispuntbank van Ondernemingen of op uw bedrijfsdocumenten (bijvoorbeeld 0123.456.789).",
    de: "Die Unternehmensnummer (ZDU) muss aus 10 Ziffern bestehen, aber Sie haben {n} eingegeben. Sie finden sie auf einem Auszug der Zentralen Datenbank der Unternehmen oder auf Ihren Unternehmensdokumenten (zum Beispiel 0123.456.789).",
  },
  leadingDigit: {
    fr: "Le numéro d'entreprise (BCE) commence toujours par 0 ou 1, suivi de 9 chiffres (par exemple 0123.456.789). Vérifiez le premier chiffre : celui que vous avez saisi n'est pas correct.",
    nl: "Het ondernemingsnummer (KBO) begint altijd met 0 of 1, gevolgd door 9 cijfers (bijvoorbeeld 0123.456.789). Controleer het eerste cijfer: het cijfer dat u hebt ingevuld klopt niet.",
    de: "Die Unternehmensnummer (ZDU) beginnt immer mit 0 oder 1, gefolgt von 9 Ziffern (zum Beispiel 0123.456.789). Überprüfen Sie die erste Ziffer: Die von Ihnen eingegebene ist nicht korrekt.",
  },
  checksum: {
    fr: "Ce numéro d'entreprise (BCE) est bien composé de 10 chiffres commençant par 0 ou 1, mais il ne correspond à aucune entreprise : il contient probablement une erreur de frappe. Vérifiez-le chiffre par chiffre sur vos documents d'entreprise.",
    nl: "Dit ondernemingsnummer (KBO) bestaat wel uit 10 cijfers die met 0 of 1 beginnen, maar het komt met geen enkele onderneming overeen: waarschijnlijk zit er een typefout in. Controleer het cijfer voor cijfer op uw bedrijfsdocumenten.",
    de: "Diese Unternehmensnummer (ZDU) besteht zwar aus 10 Ziffern, die mit 0 oder 1 beginnen, entspricht aber keinem Unternehmen: Sie enthält wahrscheinlich einen Tippfehler. Überprüfen Sie sie Ziffer für Ziffer auf Ihren Unternehmensdokumenten.",
  },
};

// Idem pour `tva_be` : même règle, même diagnostic (`diagnoseBCE`), mais le
// texte rappelle le préfixe BE attendu — c'est la spécificité du champ TVA
// par rapport au champ BCE nu (cf. FALLBACK.tva_be existant).
const TVA_MESSAGES: BceMessageSet = {
  length: {
    fr: "Le numéro de TVA doit commencer par BE suivi de 10 chiffres, mais vous en avez saisi {n}. Par exemple BE 0123.456.789.",
    nl: "Het btw-nummer moet beginnen met BE gevolgd door 10 cijfers, maar u hebt er {n} ingevuld. Bijvoorbeeld BE 0123.456.789.",
    de: "Die MwSt-Nummer muss mit BE beginnen, gefolgt von 10 Ziffern, aber Sie haben {n} eingegeben. Zum Beispiel BE 0123.456.789.",
  },
  leadingDigit: {
    fr: "Après le préfixe BE, les 10 chiffres doivent commencer par 0 ou 1 (par exemple BE 0123.456.789). Vérifiez le premier chiffre après BE.",
    nl: "Na het voorvoegsel BE moeten de 10 cijfers beginnen met 0 of 1 (bijvoorbeeld BE 0123.456.789). Controleer het eerste cijfer na BE.",
    de: "Nach dem Präfix BE müssen die 10 Ziffern mit 0 oder 1 beginnen (zum Beispiel BE 0123.456.789). Überprüfen Sie die erste Ziffer nach BE.",
  },
  checksum: {
    fr: "Ce numéro de TVA est bien au format BE suivi de 10 chiffres commençant par 0 ou 1, mais il ne correspond à aucune entreprise : il contient probablement une erreur de frappe. Vérifiez-le chiffre par chiffre.",
    nl: "Dit btw-nummer heeft wel de vorm BE gevolgd door 10 cijfers die met 0 of 1 beginnen, maar het komt met geen enkele onderneming overeen: waarschijnlijk zit er een typefout in. Controleer het cijfer voor cijfer.",
    de: "Diese MwSt-Nummer hat zwar das Format BE gefolgt von 10 Ziffern, die mit 0 oder 1 beginnen, entspricht aber keinem Unternehmen: Sie enthält wahrscheinlich einen Tippfehler. Überprüfen Sie sie Ziffer für Ziffer.",
  },
};

/// Sélectionne le message adapté à la cause exacte du rejet (longueur /
/// premier chiffre / frappe) dans un dictionnaire BCE ou TVA.
function bceMessageFor(messages: BceMessageSet, raw: string, lang: Locale): string {
  const d = diagnoseBCE(raw);
  if (d.reason === "length") return messages.length[lang].replace("{n}", String(d.digitCount));
  if (d.reason === "leadingDigit") return messages.leadingDigit[lang];
  return messages.checksum[lang];
}

/// Construit le message BCE adapté à la cause exacte du rejet. Un `errorMsg`
/// personnalisé côté admin reste prioritaire (appelant) — même schéma que
/// `nissErrorMessage` ci-dessus.
export function bceErrorMessage(raw: string, lang: Locale): string {
  return bceMessageFor(BCE_MESSAGES, raw, lang);
}

/// Idem pour `tva_be` — même diagnostic (`diagnoseBCE`), texte qui rappelle
/// le préfixe BE attendu.
export function tvaErrorMessage(raw: string, lang: Locale): string {
  return bceMessageFor(TVA_MESSAGES, raw, lang);
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
      return z
        .string()
        .refine((v) => empty(v) || isValidISODate(v), { message: errMsg(field, lang, "date") })
        // Refus du week-end (#7b) : bloque le samedi/dimanche pour les dates
        // marquées `noWeekend` (introduction / effet d'un dossier).
        .refine((v) => empty(v) || !field.noWeekend || !isWeekendISO(v), {
          message: WEEKEND_MESSAGE[lang],
        });
    case "niss":
      // Ne BLOQUE l'envoi que sur une longueur incorrecte ou une date impossible
      // (confusion année/mois/jour). Un échec de checksum seul n'est PAS bloquant
      // (cf. nissBlocking + validateFieldWarning) : certains NISS légitimes —
      // date de naissance non déclarée — ne doivent pas coincer le citoyen.
      // Message dynamique selon la cause, sauf `errorMsg` admin prioritaire.
      return z.string().refine((v) => empty(v) || !nissBlocking(v), {
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
      // Message dynamique selon la cause exacte (longueur / 1er chiffre /
      // frappe), sauf `errorMsg` admin prioritaire — même schéma que `niss`
      // ci-dessus (cf. bceErrorMessage/tvaErrorMessage).
      return z.string().refine((v) => empty(v) || isValidBelgianTVA(v), {
        error: (issue) => loc(field.errorMsg, lang) || tvaErrorMessage(String(issue.input ?? ""), lang),
      });
    case "bce":
      return z.string().refine((v) => empty(v) || isValidBelgianBCE(v), {
        error: (issue) => loc(field.errorMsg, lang) || bceErrorMessage(String(issue.input ?? ""), lang),
      });
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
      // ligne-par-ligne dans buildValidator, ni ici). La FORME accepte donc
      // n'importe quel tableau, vide compris — sans ce case, on tombait sur
      // z.string() et un `[]` initial côté UI cassait la validation avec un
      // message inutile sur le champ parent (Oraliks 2026-07-07 : « j'ai mis
      // isolé sur le formulaire et j'ai pu aller au next step donc je
      // comprend pas l'erreur » — l'erreur venait d'ici, pas de la
      // visibilité). L'OBLIGATION (required), elle, EST vérifiée — mais plus
      // bas, dans le superRefine (cf. isArrayFieldFilled) : « au moins une
      // ligne réellement remplie », pas juste un tableau non vide.
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

/// Évalue une condition `visibleIf` UNIQUE (sans son éventuel `and`).
function evalVisibleCondition(cond: VisibleIf, payload: FormPayload): boolean {
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

/// Évalue la visibilité d'un champ selon `visibleIf`. La condition primaire ET
/// toutes les conditions de `and` (le cas échéant) doivent être vraies.
export function isFieldVisible(cond: VisibleIf | undefined, payload: FormPayload): boolean {
  if (!cond) return true;
  if (!evalVisibleCondition(cond, payload)) return false;
  if (cond.and) {
    for (const extra of cond.and) if (!isFieldVisible(extra, payload)) return false;
  }
  return true;
}

/// Le payload amputé des champs que le citoyen NE VOYAIT PAS au moment d'envoyer.
///
/// Un champ masqué par `visibleIf` garde sa valeur dans le state du runner : le
/// citoyen qui saisit son IBAN puis bascule sur « chèque circulaire » laisse un
/// IBAN derrière lui. Le filler le sait et saute ces champs (cf. `filler.ts`),
/// mais le moteur de règles serveur, lui, lit le payload brut — il imprimait
/// donc un numéro de compte à côté d'une case « chèque » cochée, et des
/// remarques sur des cohabitants d'un dossier déclaré isolé. Deux déclarations
/// officielles fausses, produites par la seule persistance du state.
///
/// À appliquer AVANT `resolveStamps`. Ne filtre QUE sur `visibleIf` : `hidden`
/// est une décision de présentation, et plusieurs règles compensent justement
/// un champ masqué (les cases « non » de la rubrique hors-EEE, par exemple).
/// Le filtrage est TRANSITIF, par point fixe : retirer un champ peut en rendre
/// un autre invisible à son tour. Le C1 en donne le cas exact —
/// `statutJugementPensionAlimentaire` dépend de `pensionAlimentaire`, qui dépend
/// de `statutFamilial`. Un citoyen isolé qui déclare un jugement puis se dit
/// cohabitant laisse les deux valeurs derrière lui ; une passe simple garderait
/// le jugement, puisque `pensionAlimentaire` vaut encore « oui » dans le payload
/// brut. On itère donc jusqu'à ce que plus rien ne tombe.
export function visiblePayload(fields: PdfFormField[], payload: FormPayload): FormPayload {
  const out: FormPayload = { ...payload };
  const gated = fields.filter((f) => f.visibleIf && f.id in out);
  let removed = true;
  while (removed) {
    removed = false;
    for (const f of gated) {
      if (!(f.id in out)) continue;
      if (!isFieldVisible(f.visibleIf, out)) {
        delete out[f.id];
        removed = true;
      }
    }
  }
  return out;
}

/// Vrai si la valeur d'un SOUS-CHAMP (une cellule d'une ligne de champ
/// `array`) constitue une réponse réelle. Même définition d'« empty » que le
/// check "required" scalaire de `buildValidator` ci-dessous, généralisée par
/// type de sous-champ. Les sous-champs d'un `array` ne supportent pas
/// eux-mêmes le type "array" (un seul niveau, cf. `PdfFormField.itemFields`),
/// donc pas de récursion à prévoir ici.
/// Forme minimale d'un sous-champ de ligne `array`. Volontairement réduite à
/// `id` + `type` : c'est tout ce que la règle « ligne remplie » a besoin de
/// connaître, et c'est le plus grand dénominateur commun entre `PdfFormField`
/// (côté serveur, porte `pdfFieldName`) et `PublicField` (côté client, ne le
/// porte pas). Typer ça `PdfFormField[]` rendait `FieldLike` incompatible avec
/// `PublicField` et cassait le typecheck de `components/pdf-forms/pdf-field.tsx`.
type ItemFieldLike = { id: string; type: PdfFormField["type"] };

function isRowValueFilled(subField: ItemFieldLike | undefined, raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  if (subField?.type === "checkbox") return raw === true;
  if (subField?.type === "fullname") {
    return isFullNameValue(raw) && !!(raw.first ?? "").trim() && !!(raw.last ?? "").trim();
  }
  if (typeof raw === "string") return raw.trim() !== "";
  if (typeof raw === "number") return true; // 0 est une saisie valide (montant, etc.).
  if (typeof raw === "boolean") return raw === true;
  return false;
}

/// Vrai si une LIGNE d'un champ `array` porte au moins une réponse réelle.
/// Sert à distinguer une ligne vierge — celle que `ArrayField.addRow` (cf.
/// components/pdf-forms/array-field.tsx) crée au clic sur « + Ajouter », qui
/// ne pose que les `defaultValue` déclarées et laisse le reste absent — d'une
/// ligne où le citoyen a effectivement répondu. Sans `itemFields` (jamais le
/// cas en pratique — filet défensif), on retombe sur un test générique de
/// toutes les valeurs présentes dans la ligne.
function isRowFilled(row: FieldValueRecord, itemFields: ItemFieldLike[] | undefined): boolean {
  if (!itemFields || itemFields.length === 0) {
    return Object.values(row).some((v) => isRowValueFilled(undefined, v));
  }
  return itemFields.some((sf) => isRowValueFilled(sf, row[sf.id]));
}

/// Vrai si un champ `array` porte au moins une ligne réellement remplie.
/// `minRows` peut imposer des lignes présentes dès le départ : leur seule
/// PRÉSENCE dans le tableau ne suffit pas (cf. isRowFilled) — `[]` et `[{}]`
/// comptent tous les deux comme vides, `[{ nature: "Plombier" }]` comme
/// rempli. Partagée par `buildValidator` (superRefine, blocage à l'envoi) ET
/// `isFieldComplete` (compteur du stepper) pour que les deux appliquent
/// EXACTEMENT la même règle.
function isArrayFieldFilled(value: unknown, itemFields: ItemFieldLike[] | undefined): boolean {
  return isFieldValueRecordArray(value) && value.some((row) => isRowFilled(row, itemFields));
}

/// Construit le validateur Zod d'un formulaire pour une locale donnée.
/// Les champs requis ne sont vérifiés que s'ils sont visibles.
export function buildValidator(fields: PdfFormField[], lang: Locale = DEFAULT_LOCALE) {
  const shape: Record<string, ZodTypeAny> = {};
  for (const f of fields) {
    // Champs auto (signature, date du jour, autoAnswered) : jamais rendus
    // comme controle interactif, remplis programmatiquement par le runner
    // et re-injectes de maniere autoritaire cote serveur (route /generate).
    // On les exclut totalement du schema Zod — cf. bug persistant Oraliks
    // 2026-07-07 ou dateSignature="2026-07-05" (valide ISO, required=false)
    // continuait a etre flag sur la path Zod sans explication, meme apres
    // le skip conditionnel dans superRefine et required=false cote schema.
    if (isAutoField(f)) continue;
    shape[f.id] = fieldToZod(f, lang).optional();
  }

  return z.object(shape).superRefine((data, ctx) => {
    const payload = data as FormPayload;
    for (const f of fields) {
      if (isAutoField(f)) continue;
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
      // Un champ `array` requis exige AU MOINS UNE ligne réellement remplie
      // (cf. isArrayFieldFilled) : un tableau vide, ou qui ne contient que des
      // lignes vierges (aucun sous-champ non vide — ex. une ligne tout juste
      // ajoutée par le bouton « + Ajouter »), ne compte pas comme une réponse.
      const arrayIncomplete = f.type === "array" && !isArrayFieldFilled(v, f.itemFields);
      const isEmpty =
        v === null ||
        v === undefined ||
        (typeof v === "string" && v.trim() === "") ||
        (f.type === "checkbox" && v === false) ||
        fullNameIncomplete ||
        arrayIncomplete;
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
  noWeekend?: PdfFormField["noWeekend"];
  /// Schéma des lignes d'un champ `array` — nécessaire à `isFieldComplete`
  /// pour juger une ligne « remplie » sous-champ par sous-champ (cf.
  /// isArrayFieldFilled). Absent (undefined) pour tous les autres types.
  itemFields?: ItemFieldLike[];
};

/// Vrai si la date ISO (YYYY-MM-DD) tombe un samedi ou un dimanche. Parse en
/// UTC pour éviter tout décalage de fuseau. Une chaîne non-ISO → false.
export function isWeekendISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const day = new Date(iso + "T00:00:00Z").getUTCDay();
  return day === 0 || day === 6;
}

const WEEKEND_MESSAGE: Record<Locale, string> = {
  fr: "Cette date tombe un week-end. Aucun dossier ne peut être introduit un samedi ou un dimanche — choisis un jour de semaine (renseigne-toi auprès de ton organisme de paiement pour une exception).",
  nl: "Deze datum valt in het weekend. Een dossier kan niet worden ingediend op zaterdag of zondag — kies een weekdag (vraag je uitbetalingsinstelling om een uitzondering).",
  de: "Dieses Datum fällt auf ein Wochenende. Ein Antrag kann nicht an einem Samstag oder Sonntag eingereicht werden — wähle einen Wochentag (frage deine Zahlstelle nach einer Ausnahme).",
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
    // NISS : n'affiche une ERREUR (rouge, bloquante) que sur longueur ou date
    // impossible. Le checksum seul est un AVERTISSEMENT non bloquant, rendu par
    // `validateFieldWarning` (ambre) — cf. #4.
    case "niss": return nissBlocking(v) ? (custom || nissErrorMessage(v, lang)) : null;
    case "iban":
      return field.internationalIban
        ? (isValidInternationalIBAN(v) ? null : (custom || FALLBACK.iban_international[lang]))
        : (isValidBelgianIBAN(v) ? null : (custom || FALLBACK.iban[lang]));
    case "date":
      if (!isValidISODate(v)) return custom || FALLBACK.date[lang];
      // Refus du week-end pour les dates d'introduction/effet (#7b).
      if (field.noWeekend && isWeekendISO(v)) return WEEKEND_MESSAGE[lang];
      return null;
    case "email": return isValidEmail(v) ? null : (custom || FALLBACK.email[lang]);
    case "phone_be": return isValidBelgianPhone(v) ? null : (custom || FALLBACK.phone_be[lang]);
    case "postal_be": return isValidBelgianPostalCode(v) ? null : (custom || FALLBACK.postal_be[lang]);
    case "tva_be": return isValidBelgianTVA(v) ? null : (custom || tvaErrorMessage(v, lang));
    case "bce": return isValidBelgianBCE(v) ? null : (custom || bceErrorMessage(v, lang));
    default: return null;
  }
}

/// Avertissement NON bloquant pour un champ (ambre) — distinct de l'erreur
/// (rouge, bloquante) de `validateFieldFormat`. Aujourd'hui : un NISS dont la
/// date est cohérente mais dont le checksum échoue (on prévient l'utilisateur
/// de vérifier sa saisie sans l'empêcher de continuer — #4). Renvoie `null`
/// si rien à signaler. Une valeur vide ne déclenche jamais d'avertissement.
export function validateFieldWarning(field: FieldLike, value: unknown, lang: Locale): string | null {
  const v = typeof value === "string" ? value : "";
  if (v.trim() === "") return null;
  if (field.type === "niss" && !nissBlocking(v) && !isValidNISS(v)) {
    return loc(field.errorMsg, lang) || NISS_MESSAGES.checksum[lang];
  }
  return null;
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
  // Même définition que le check "required" de buildValidator (cf.
  // isArrayFieldFilled) : au moins une ligne réellement remplie, pas
  // seulement un tableau non vide (une ligne vierge ne compte pas).
  if (field.type === "array") return isArrayFieldFilled(value, field.itemFields);
  const v = typeof value === "string" || typeof value === "number" ? String(value) : "";
  if (v.trim() === "") return false;
  return validateFieldFormat(field, v, lang) === null;
}

/// Exigences applicables à un lot de champs (une étape du stepper) et celles
/// qui ne sont PAS satisfaites, avec EXACTEMENT les mêmes règles que
/// `buildValidator` :
///   • un champ `required` VISIBLE et non auto compte pour 1 ;
///   • chaque `requiredGroup` VISIBLE compte pour 1 (« au moins un parmi N »),
///     satisfait dès qu'un seul membre est rempli/coché.
///
/// Sert au stepper (coche verte + « N champs restants »). Compter les
/// `required` à la main — ce que faisait le runner — ratait `visibleIf` ET
/// `requiredGroup` : l'étape Motif du C1, dont le seul `required` est la date
/// (les 5 chips forment un `requiredGroup`), s'affichait « complète » dès la
/// date remplie, sans aucun motif coché (bug Oraliks 2026-07-26).
///
/// `total === 0` = l'étape n'a rien d'obligatoire → ni coche ni compteur.
export function countRequirements(
  fields: PdfFormField[],
  payload: FormPayload,
  lang: Locale = DEFAULT_LOCALE
): { total: number; missing: number } {
  let total = 0;
  let missing = 0;

  for (const f of fields) {
    // Mêmes exclusions que `buildValidator` : ces champs sont remplis
    // programmatiquement (runner + ré-injection serveur), jamais saisis.
    if (isAutoField(f) || f.prefillFrom === "system.today" || f.type === "signature") continue;
    if (!isFieldVisible(f.visibleIf, payload)) continue;

    if (f.required) {
      total += 1;
      if (!isFieldComplete(f, payload[f.id], lang)) missing += 1;
      continue;
    }

    // Champ FACULTATIF rempli mais MAL FORMÉ. `buildValidator` applique ses
    // contrôles de format à TOUS les champs de l'étape, pas seulement aux
    // requis (`fieldToZod(...).optional()` ne protège que `undefined`) : un
    // téléphone facultatif mal saisi bloque donc « Continuer ». Sans ce
    // décompte, l'étape restait cochée verte pendant que le bouton refusait
    // d'avancer — le stepper et le bouton se contredisaient.
    const value = payload[f.id];
    const filled = typeof value === "string" && value.trim() !== "";
    if (filled && !isFieldComplete(f, value, lang)) {
      total += 1;
      missing += 1;
    }
  }

  const groups = new Map<string, PdfFormField[]>();
  for (const f of fields) {
    if (!f.requiredGroup) continue;
    if (!isFieldVisible(f.visibleIf, payload)) continue;
    const list = groups.get(f.requiredGroup);
    if (list) list.push(f);
    else groups.set(f.requiredGroup, [f]);
  }
  for (const members of groups.values()) {
    total += 1;
    const anySet = members.some((f) => {
      const v = payload[f.id];
      if (f.type === "checkbox") return v === true;
      return typeof v === "string" && v.trim() !== "";
    });
    if (!anySet) missing += 1;
  }

  return { total, missing };
}

export { anchoredRegex };
