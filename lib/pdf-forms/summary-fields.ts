// Sélection & résolution des valeurs pour le récapitulatif final allégé du
// form-runner (§10.6). Module PUR (aucune dépendance React / i18n texte) :
//   - `selectCriticalSummary` : le petit ensemble « champs critiques » affiché
//     en tête de l'étape finale (identité, motif(s) coché(s), date du
//     changement, organisme de paiement).
//   - `resolveRecapValue` / `isAnswered` : brique de rendu réutilisée par
//     l'expander « Voir toutes mes réponses » (liste lecture seule complète).
//
// Chaque fonction résout les valeurs de la même façon que `SummaryStep`
// (fullname, case à cocher, option select/radio) mais sans dépendre du
// composant : le libellé Oui/Non éventuel est fourni par l'appelant (i18n).
//
// Les libellés des 4 catégories critiques sont renvoyés sous forme de CLÉS
// i18n (champ `label`) — c'est l'appelant (composant client) qui les traduit
// via `t(entry.label)`. Cela garde ce module 100 % pur et testable.

import type {
  FieldOption,
  FieldType,
  FieldValue,
  FieldValueRecord,
  FormPayload,
  FullNameValue,
  Localized,
  Locale,
  NameOrder,
  VisibleIf,
} from "./types";
import { loc, isFullNameValue, isFieldValueRecordArray } from "./types";
import { isFieldVisible } from "./validation";
import { isAutoField } from "./auto-fields";

/// Forme minimale d'un champ acceptée par ce module — satisfaite SANS cast par
/// `PublicField` (client) ET `PdfFormField` (serveur). On n'accède qu'aux
/// propriétés réellement lues ici.
export interface SummaryFieldLike {
  id: string;
  type: FieldType;
  label: Localized;
  labelShort?: Localized;
  options?: FieldOption[];
  nameOrder?: NameOrder;
  visibleIf?: VisibleIf;
  autoAnswered?: boolean;
  prefillFrom?: string;
  requiredGroup?: string;
  canonicalKey?: string;
  section?: string;
}

/// Une entrée du récapitulatif critique : `label` = CLÉ i18n (à traduire par
/// l'appelant), `value` = valeur déjà résolue en texte lisible.
export interface CriticalSummaryEntry {
  label: string;
  value: string;
}

/// Clés i18n des 4 catégories critiques (cf. messages `public.dossier`).
const CRITICAL_KEYS = {
  identity: "runnerSummaryCriticalIdentity",
  motif: "runnerSummaryCriticalMotif",
  changeDate: "runnerSummaryCriticalChangeDate",
  paymentOrg: "runnerSummaryCriticalPaymentOrg",
} as const;

/// Ids de champs `date` considérés comme « date du changement / d'effet »
/// (détection par id, indépendante du dossier — ex. C1 :
/// `dateModificationEffective`, `dateChangementOrganisme`).
const CHANGE_DATE_ID_RE = /(modif|changement|transfert|effet|effect)/;
/// Id d'un champ « organisme de paiement » (choix de l'OP destinataire). On
/// exclut explicitement les follow-ups « déjà déclaré à l'organisme » (radios
/// oui/non dont le libellé — mais PAS l'id — mentionne l'organisme).
const PAYMENT_ORG_ID_RE = /(organismepaiement|nouvelorganisme|paymentorg)/;
const PAYMENT_ORG_KEY_RE = /(paiement\.organisme|organisme\.paiement|organismepaiement)/;

/// Valeur texte simple : chaîne (trim) ou nombre ; sinon "".
function textValue(raw: FieldValue | undefined): string {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number") return String(raw);
  return "";
}

/// Assemble un `fullname` en respectant l'ordre déclaré.
function combineName(field: SummaryFieldLike, v: FullNameValue): string {
  const order: NameOrder = field.nameOrder ?? "first-last";
  const parts = order === "last-first" ? [v.last, v.first] : [v.first, v.last];
  return parts.map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
}

/// Libellé (préfère la version courte si présente) d'un champ.
function shortLabel(field: SummaryFieldLike, locale: Locale): string {
  const short = field.labelShort ? loc(field.labelShort, locale) : "";
  return short || loc(field.label, locale) || field.id;
}

/// Libellé de l'option choisie pour un select/radio (ou null si pas d'options
/// / valeur hors liste).
function optionLabel(field: SummaryFieldLike, raw: FieldValue | undefined, locale: Locale): string | null {
  if (!field.options || field.options.length === 0) return null;
  const opt = field.options.find((o) => o.value === raw);
  if (!opt) return null;
  return loc(opt.label, locale) || opt.value;
}

/// Résumé d'une valeur `array` : chaque ligne = ses valeurs scalaires non
/// vides jointes par « , » ; les lignes par « · ». Renvoie "" si tout est vide.
function summarizeRows(rows: FieldValueRecord[]): string {
  const parts = rows
    .map((row) =>
      Object.values(row)
        .map((v) => {
          if (isFullNameValue(v)) return [v.first, v.last].map((p) => (p ?? "").trim()).filter(Boolean).join(" ");
          if (typeof v === "string") return v.trim();
          if (typeof v === "number") return String(v);
          return "";
        })
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean);
  return parts.join(" · ");
}

/// true si le champ a une valeur réellement renseignée (non vide). Une case à
/// cocher n'est « répondue » que si cochée (on n'affiche pas les cases
/// décochées dans le récap) ; un radio « non » RESTE une réponse (affichée).
export function isAnswered(field: SummaryFieldLike, values: FormPayload): boolean {
  const raw = values[field.id];
  if (raw === undefined || raw === null) return false;
  if (field.type === "checkbox") return raw === true;
  if (isFullNameValue(raw)) return !!((raw.first ?? "").trim() || (raw.last ?? "").trim());
  if (isFieldValueRecordArray(raw)) return summarizeRows(raw) !== "";
  if (typeof raw === "string") return raw.trim() !== "";
  if (typeof raw === "number") return true;
  if (typeof raw === "boolean") return true;
  return String(raw).trim() !== "";
}

/// Valeur AFFICHABLE (lecture seule) d'un champ pour le récap complet :
///   - checkbox        → `labels.yes` / `labels.no`
///   - fullname        → « Prénom Nom » (respecte nameOrder)
///   - array           → lignes résumées
///   - select / radio  → libellé de l'option choisie
///   - autre           → texte brut
/// Renvoie "" si non renseigné (l'appelant affiche alors un tiret).
export function resolveRecapValue(
  field: SummaryFieldLike,
  values: FormPayload,
  locale: Locale,
  labels: { yes: string; no: string }
): string {
  const raw = values[field.id];
  if (raw === undefined || raw === null) return "";
  if (field.type === "checkbox") return raw === true ? labels.yes : labels.no;
  if (isFullNameValue(raw)) return combineName(field, raw);
  if (isFieldValueRecordArray(raw)) return summarizeRows(raw);
  const opt = optionLabel(field, raw, locale);
  if (opt !== null) return opt;
  return textValue(raw);
}

// --- Résolveurs des 4 catégories critiques -------------------------------

function resolveIdentity(fields: readonly SummaryFieldLike[], values: FormPayload): string {
  // a) champ `fullname` (Prénom + Nom fusionnés).
  const fn = fields.find((f) => f.type === "fullname");
  if (fn) {
    const raw = values[fn.id];
    if (isFullNameValue(raw)) {
      const s = combineName(fn, raw);
      if (s) return s;
    }
  }
  // b) deux champs séparés repérés par clé canonique (ex. C1 : nom / pr_nom).
  const byKey = (k: string) => fields.find((f) => f.canonicalKey === k);
  const byId = (re: RegExp) => fields.find((f) => re.test(f.id.toLowerCase()));
  const prenomField = byKey("identity.prenom") ?? byId(/^(pr[_-]?nom|prenom|firstname)$/);
  const nomField = byKey("identity.nom") ?? byId(/^(nom|lastname)$/);
  const prenom = prenomField ? textValue(values[prenomField.id]) : "";
  const nom = nomField ? textValue(values[nomField.id]) : "";
  return [prenom, nom].filter(Boolean).join(" ").trim();
}

function resolveMotif(fields: readonly SummaryFieldLike[], values: FormPayload, locale: Locale): string {
  // a) cases « situation » d'un groupe requis cochées (ex. 5 chips du C1).
  const chips = fields.filter(
    (f) => f.requiredGroup && f.type === "checkbox" && values[f.id] === true
  );
  if (chips.length > 0) {
    return chips.map((f) => shortLabel(f, locale)).filter(Boolean).join(", ");
  }
  // b) repli : un motif radio/select répondu (formulaires hors modèle C1).
  const motifField = fields.find(
    (f) =>
      (f.type === "radio" || f.type === "select") &&
      (/motif/i.test(f.id) || /motif/i.test(f.canonicalKey ?? ""))
  );
  if (motifField) {
    const opt = optionLabel(motifField, values[motifField.id], locale);
    if (opt) return opt;
  }
  return "";
}

function resolveChangeDate(fields: readonly SummaryFieldLike[], values: FormPayload): string {
  const dates = fields.filter((f) => f.type === "date" && CHANGE_DATE_ID_RE.test(f.id.toLowerCase()));
  const vals = dates.map((f) => textValue(values[f.id])).filter(Boolean);
  return Array.from(new Set(vals)).join(", ");
}

function resolvePaymentOrg(fields: readonly SummaryFieldLike[], values: FormPayload, locale: Locale): string {
  const field = fields.find((f) => {
    if (f.type === "checkbox") return false;
    const id = f.id.toLowerCase();
    if (/declar/.test(id)) return false; // exclut les follow-ups « déjà déclaré »
    return PAYMENT_ORG_ID_RE.test(id) || PAYMENT_ORG_KEY_RE.test((f.canonicalKey ?? "").toLowerCase());
  });
  if (!field) return "";
  const raw = values[field.id];
  const opt = optionLabel(field, raw, locale);
  return opt ?? textValue(raw);
}

/// Sélectionne l'ensemble « champs critiques » (§10.6) à afficher en tête de
/// l'étape finale : identité (nom/prénom), motif(s) coché(s), date du
/// changement, organisme de paiement. Chaque entrée dont la valeur est vide
/// est OMISE. Ne prend en compte que les champs VISIBLES (`visibleIf`) et non
/// automatiques (signature / date auto / autoAnswered).
///
/// `label` de chaque entrée = clé i18n (à résoudre par l'appelant).
export function selectCriticalSummary(
  fields: readonly SummaryFieldLike[],
  values: FormPayload,
  locale: Locale
): CriticalSummaryEntry[] {
  const visible = fields.filter((f) => !isAutoField(f) && isFieldVisible(f.visibleIf, values));

  const out: CriticalSummaryEntry[] = [];
  const push = (label: string, value: string) => {
    if (value) out.push({ label, value });
  };

  push(CRITICAL_KEYS.identity, resolveIdentity(visible, values));
  push(CRITICAL_KEYS.motif, resolveMotif(visible, values, locale));
  push(CRITICAL_KEYS.changeDate, resolveChangeDate(visible, values));
  push(CRITICAL_KEYS.paymentOrg, resolvePaymentOrg(visible, values, locale));

  return out;
}
