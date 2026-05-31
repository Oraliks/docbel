import { AcroFieldRaw, FieldType, PdfFormField } from "./types";

/// Construit un id slug stable à partir d'un nom de champ PDF.
function makeId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 60) || "field"
  );
}

/// Humanise un nom technique en libellé lisible ("date_naissance" → "Date naissance").
function humanize(name: string): string {
  return name
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/// Indices (nom + tooltip) → type sémantique probable.
/// Ordre = priorité (le 1er match gagne). Les types qui ont aussi un sens
/// "auto-injecté" (signature, date de création) sont gérés en plus dans
/// `inferAutoPrefill` ci-dessous pour positionner `prefillFrom`.
const TYPE_HINTS: Array<{ re: RegExp; type: FieldType }> = [
  { re: /\b(niss|rrn|rijksregister|registre.?national|national.?number)\b/i, type: "niss" },
  { re: /\b(iban|compte|rekening|bank.?account)\b/i, type: "iban" },
  { re: /\b(bce|kbo|ondernemingsnummer|entreprise.?num)\b/i, type: "bce" },
  { re: /\b(tva|btw|vat)\b/i, type: "tva_be" },
  { re: /\b(code.?postal|postcode|cp|plz)\b/i, type: "postal_be" },
  { re: /\b(t[ée]l|gsm|phone|telefoon|mobile)\b/i, type: "phone_be" },
  { re: /\b(e?.?mail|courriel)\b/i, type: "email" },
  { re: /\b(signature|handtekening|unterschrift|signed?.?by|signer)\b/i, type: "signature" },
  { re: /\b(date|datum|naissance|geboorte|jour)\b/i, type: "date" },
];

/// Reconnaissance des patterns de "date de création / génération" : un champ
/// qui doit être pré-rempli automatiquement par la date du jour à la
/// génération, et masqué du formulaire utilisateur.
const CREATION_DATE_RE =
  /(date.{0,5}(cr[ée]ation|g[ée]n[ée]ration|jour|today|edit)|aanmaakdatum|datum.{0,5}aanmaak|erstellungsdatum)/i;

/// Indices → section de regroupement.
const SECTION_HINTS: Array<{ re: RegExp; section: string }> = [
  { re: /\b(nom|prenom|pr[ée]nom|name|voornaam|achternaam|niss|naissance|sexe|genre)\b/i, section: "identite" },
  { re: /\b(rue|adresse|adres|street|postal|postcode|commune|ville|stad|localit)\b/i, section: "adresse" },
  { re: /\b(employeur|werkgever|entreprise|bce|tva|patron|societe|soci[ée]t[ée])\b/i, section: "employeur" },
  { re: /\b(iban|compte|banque|bank|rekening)\b/i, section: "banque" },
];

function inferType(raw: AcroFieldRaw): FieldType {
  if (raw.acroType === "checkbox") return "checkbox";
  if (raw.acroType === "dropdown" || raw.acroType === "radio") return "select";
  const hay = `${raw.pdfFieldName} ${raw.tooltip ?? ""}`;
  for (const h of TYPE_HINTS) if (h.re.test(hay)) return h.type;
  if (raw.multiline) return "textarea";
  return "text";
}

function inferSection(raw: AcroFieldRaw): string | undefined {
  const hay = `${raw.pdfFieldName} ${raw.tooltip ?? ""}`;
  for (const h of SECTION_HINTS) if (h.re.test(hay)) return h.section;
  return undefined;
}

/// Transforme l'extraction brute en schéma enrichi initial (pré-rempli ~80%).
/// L'admin n'a plus qu'à corriger labels NL/DE et ajuster la validation.
export function buildEnrichedSchema(raw: AcroFieldRaw[]): PdfFormField[] {
  const usedIds = new Set<string>();
  return raw.map((r, i) => {
    let id = makeId(r.pdfFieldName);
    let n = 1;
    while (usedIds.has(id)) id = `${makeId(r.pdfFieldName)}_${n++}`;
    usedIds.add(id);

    let type = inferType(r);
    const labelFr = r.tooltip ? r.tooltip : humanize(r.pdfFieldName);
    const hay = `${r.pdfFieldName} ${r.tooltip ?? ""}`;

    // "Date de création / génération" : type date + prefill system.today,
    // ce qui masque le champ du formulaire (rempli auto à la génération).
    let prefillFrom: PdfFormField["prefillFrom"] | undefined;
    if (CREATION_DATE_RE.test(hay)) {
      type = "date";
      prefillFrom = "system.today";
    }

    const field: PdfFormField = {
      id,
      pdfFieldName: r.pdfFieldName,
      type,
      required: !!r.required,
      label: { fr: labelFr },
      order: i,
      acroType: r.acroType,
      readOnly: r.readOnly,
    };
    if (prefillFrom) field.prefillFrom = prefillFrom;
    if (r.maxLen) field.maxLength = r.maxLen;
    if (r.defaultValue) field.defaultValue = r.defaultValue;
    if (r.options && (type === "select" || type === "radio")) {
      field.options = r.options.map((o) => ({ value: o, label: { fr: o } }));
    }
    const section = inferSection(r);
    if (section) field.section = section;
    return field;
  });
}

export { makeId, humanize };
