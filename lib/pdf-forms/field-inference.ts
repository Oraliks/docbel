import { AcroFieldRaw, FieldType, PdfFormField, CanonicalKey } from "./types";

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

/// Indices (nom + tooltip) → clé du vocabulaire canonique. Ordre = priorité
/// (le 1er match gagne). Ces heuristiques n'écrasent JAMAIS un canonicalKey
/// posé manuellement dans un seed — l'inférence agit uniquement au parse
/// initial d'un PDF. Cf. Phase 2 du plan bindings-canonical-ux : un champ
/// tagué canonicalKey se pré-remplit automatiquement d'un formulaire à
/// l'autre dans un même dossier.
///
/// Attention aux faux positifs :
/// - « Nom du titulaire » (banque) ≠ identity.nom → le regex `banque.titulaire`
///   passe AVANT `identity.nom` pour intercepter ce cas ;
/// - « nationalité » ≠ pays de résidence → `identity.nationalite` distingué
///   de `adresse.pays` par regex plus stricte.
const CANONICAL_HINTS: Array<{ re: RegExp; key: CanonicalKey }> = [
  // Banque en premier — pièges typiques (« nom du titulaire », « iban BE »).
  { re: /\btitulaire\b/i, key: "banque.titulaire" },
  { re: /\biban\b/i, key: "banque.iban" },
  { re: /\bbic\b|\bswift\b/i, key: "banque.bic" },
  // Contact.
  { re: /\b(e?.?mail|courriel|e-mail)\b/i, key: "contact.email" },
  { re: /\b(t[ée]l|gsm|phone|telefoon|mobile)\b/i, key: "contact.telephone" },
  // Adresse.
  { re: /\b(code.?postal|postcode)\b/i, key: "adresse.codePostal" },
  { re: /\b(rue|street|straat)\b/i, key: "adresse.rue" },
  { re: /^num[ée]?ro$|\bnr\b/i, key: "adresse.numero" },
  { re: /\b(bo[îi]te|bus|box)\b/i, key: "adresse.boite" },
  { re: /\bpays\b/i, key: "adresse.pays" },
  // Identité — nationalité AVANT nom pour éviter que « nationalité » soit
  // capturé par le regex `\bnom\b` (il ne l'est pas, mais garde la garantie).
  // `nationalit[ée]` — le `é` final n'est pas un caractère de mot pour \b
  // en JS regex (ASCII-only), donc pas de \b trailing sur cette forme.
  { re: /\bnationalit[ée](?=\W|$)/i, key: "identity.nationalite" },
  // `rijksregister` peut être suivi de « nummer » (compound néerlandais) —
  // pas de \b trailing pour ce token. Les autres alternatives (niss, rrn,
  // registre national) restent avec \b propres.
  { re: /\b(niss|rrn|registre.?national)\b|\brijksregister/i, key: "identity.niss" },
  { re: /\b(date.?naissance|geboortedatum|birthdate)\b/i, key: "identity.dateNaissance" },
  { re: /\b(pr[ée]nom|voornaam|first.?name)\b/i, key: "identity.prenom" },
  // « Nom » en dernier — c'est le regex le plus large, il ne doit matcher
  // que les widgets qui n'ont pas déjà été identifiés comme prénom /
  // titulaire / nom de rue / etc.
  { re: /\b(nom|last.?name|achternaam)\b/i, key: "identity.nom" },
  // Famille.
  { re: /\b(statut.?familial|situation.?familiale|burgerlijke.?staat)\b/i, key: "famille.statut" },
];

/// Infère une `canonicalKey` depuis le nom et le tooltip d'un widget PDF.
/// Utilise `CANONICAL_HINTS` — retourne `undefined` si aucun match (le
/// champ reste sans clé canonique, ce qui est le comportement le plus safe :
/// pas de pré-remplissage automatique cross-form pour ce champ).
///
/// Contrainte de sécurité : on n'infère PAS de canonicalKey sur un champ
/// checkbox / radio / dropdown — la sémantique canonique s'applique aux
/// valeurs textuelles seules (identity/adresse/banque = strings).
function inferCanonicalKey(raw: AcroFieldRaw): CanonicalKey | undefined {
  if (raw.acroType !== "text") return undefined;
  const hay = `${raw.pdfFieldName} ${raw.tooltip ?? ""}`;
  for (const h of CANONICAL_HINTS) if (h.re.test(hay)) return h.key;
  return undefined;
}

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
    // Auto-tagging canonicalKey depuis les heuristiques — n'écrase jamais
    // un tag manuel (cette fonction ne tourne QU'au parse initial d'un PDF ;
    // les seeds enrichis passent après via `applyC1Improvements` qui
    // remplace le champ complet). Cf. Phase 2 du plan bindings.
    const canonicalKey = inferCanonicalKey(r);
    if (canonicalKey) field.canonicalKey = canonicalKey;
    return field;
  });
}

export { makeId, humanize };
