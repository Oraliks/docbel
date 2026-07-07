// Types du module PDF Forms (AcroForm only).

/// Locales officielles belges supportées. FR est toujours présent.
export type Locale = "fr" | "nl" | "de";
export const LOCALES: Locale[] = ["fr", "nl", "de"];
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(v: unknown): v is Locale {
  return v === "fr" || v === "nl" || v === "de";
}

/// Contenu localisé. La clé `fr` est la référence ; nl/de sont optionnelles.
export type Localized = Partial<Record<Locale, string>>;

/// Résout un texte localisé avec repli sur la locale par défaut puis FR.
export function loc(
  value: Localized | undefined,
  lang: Locale,
  fallback: Locale = DEFAULT_LOCALE
): string {
  if (!value) return "";
  return value[lang] ?? value[fallback] ?? value.fr ?? "";
}

// ---------------------------------------------------------------------------
// Niveau technique : extraction brute de l'AcroForm (ancre immuable).
// ---------------------------------------------------------------------------

export type AcroFieldType = "text" | "checkbox" | "dropdown" | "radio" | "unknown";

export interface AcroFieldRaw {
  /// Nom exact du champ dans le PDF (clé de remplissage — NE PAS modifier).
  pdfFieldName: string;
  acroType: AcroFieldType;
  /// Tooltip PDF (clé /TU) — souvent un libellé lisible exploitable.
  tooltip?: string;
  /// Longueur max imposée par le PDF (/MaxLen).
  maxLen?: number;
  /// Valeur par défaut du PDF (/DV).
  defaultValue?: string;
  /// Options pour dropdown/radio (/Opt ou valeurs d'export).
  options?: string[];
  readOnly?: boolean;
  required?: boolean;
  multiline?: boolean;
  /// Index de page (0-based) du premier widget rattaché au champ.
  page?: number;
  /// Rectangle du widget [x, y, w, h] en points PDF — utile au regroupement.
  rect?: [number, number, number, number];
}

// ---------------------------------------------------------------------------
// Niveau enrichi : ce que l'admin édite et ce que le front consomme.
// ---------------------------------------------------------------------------

/// Type sémantique d'un champ (validation/UX). Étend les types AcroForm bruts.
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "radio"
  | "fullname"
  | "signature"
  | "niss"
  | "iban"
  | "postal_be"
  | "tva_be"
  | "bce"
  | "phone_be"
  | "email"
  /// Tableau de lignes structurées (ex. grille des cohabitants du C1).
  /// Le champ porte `itemFields: PdfFormField[]` qui décrit le schéma de
  /// chaque ligne. Valeur dans le payload = `FieldValueRecord[]`.
  | "array";

export const SEMANTIC_FIELD_TYPES: FieldType[] = [
  "text", "textarea", "number", "date", "checkbox", "select", "radio",
  "fullname", "signature",
  "niss", "iban", "postal_be", "tva_be", "bce", "phone_be", "email",
  "array",
];

/// Libellés lisibles (FR) pour le sélecteur de type côté admin. Le public ne
/// voit jamais ces libellés (il voit le `label` du champ) — c'est uniquement
/// pour que l'admin reconnaisse chaque type sans connaître l'anglais.
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texte (court)",
  textarea: "Texte (long, multiligne)",
  number: "Nombre",
  date: "Date",
  checkbox: "Case à cocher",
  select: "Liste déroulante",
  radio: "Boutons radio",
  fullname: "Nom complet (Prénom + Nom)",
  signature: "Signature (dessinée à la main)",
  niss: "NISS (registre national)",
  iban: "IBAN (compte bancaire)",
  postal_be: "Code postal (Belgique)",
  tva_be: "Numéro de TVA",
  bce: "Numéro d'entreprise (BCE)",
  phone_be: "Téléphone (Belgique)",
  email: "Adresse e-mail",
  array: "Tableau (lignes répétables)",
};

/// Ordre d'assemblage d'un champ `fullname` (deux sous-champs côté front,
/// un seul champ texte côté PDF).
export type NameOrder = "first-last" | "last-first";

/// Source de pré-remplissage. `itsme.*` = claims OIDC itsme ;
/// `profile.*` = profil utilisateur connecté.
export type PrefillSource =
  | "system.today"
  | "itsme.firstName"
  | "itsme.lastName"
  | "itsme.niss"
  | "itsme.birthDate"
  | "itsme.gender"
  | "itsme.street"
  | "itsme.postalCode"
  | "itsme.city"
  | "profile.firstName"
  | "profile.lastName"
  | "profile.niss"
  | "profile.birthDate"
  | "profile.gender"
  | "profile.email"
  | "profile.phone"
  | "profile.iban"
  | "profile.street"
  | "profile.postalCode"
  | "profile.city";

export type ConditionOp = "equals" | "notEquals" | "in" | "notIn";

export interface VisibleIf {
  fieldId: string;
  op: ConditionOp;
  /// Pour equals/notEquals : valeur scalaire ; pour in/notIn : tableau.
  value: string | number | boolean | Array<string | number>;
}

export interface FieldOption {
  value: string;
  label: Localized;
}

/// Dérivations de champ disponibles (registre pur dans field-derivations.ts,
/// sans dépendance lourde — safe à importer côté client). Union fermée :
/// chaque nouvelle dérivation (ex. futur code postal → commune) s'y ajoute.
export type FieldDerivation = "niss-birth-date" | "postal-be-country";

export interface PdfFormField {
  /// Identifiant stable côté schéma enrichi (slug). Distinct de pdfFieldName.
  id: string;
  /// Ancre vers l'AcroForm. Vide si champ purement logique (rare).
  pdfFieldName: string;
  type: FieldType;
  required: boolean;

  // Contenu localisé
  label: Localized;
  help?: Localized;
  placeholder?: Localized;
  errorMsg?: Localized;
  options?: FieldOption[];

  // Validation
  presetKey?: string;
  /// Regex appliquée ANCRÉE (^...$) à la validation.
  regex?: string;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;

  // Comportement / UX
  defaultValue?: string | number | boolean;
  visibleIf?: VisibleIf;
  prefillFrom?: PrefillSource;
  /// Pour les champs `fullname` : ordre d'assemblage des deux sous-champs.
  /// Défaut "first-last" (Prénom Nom).
  nameOrder?: NameOrder;
  /// Regroupement visuel ("identite", "adresse", "employeur"…).
  section?: string;
  order?: number;
  /// Habillage visuel spécifique (absent = rendu par défaut). "chip" = rendu
  /// en carte de choix cliquable (OptionCard) au lieu du widget standard —
  /// réservé aux champs où un choix visuel fait sens (ex. motif d'un C1).
  /// N'affecte ni la validation ni la valeur stockée.
  renderAs?: "chip";
  /// Priorité d'affichage de la SECTION de ce champ (tous les champs d'une
  /// même section doivent porter la même valeur). Absent/"core" = toujours
  /// une étape séquentielle obligatoire (comportement actuel). "optional" =
  /// section repliée en fin de parcours, dépliée automatiquement si déjà
  /// répondue (cf. lib/pdf-forms/build-steps.ts).
  stepPriority?: "core" | "optional";
  /// Macro-étape à laquelle appartient ce champ (regroupe plusieurs sections
  /// en un nombre restreint d'étapes, ex. C1 → 5 étapes). Absent = pas de
  /// mode macro (le formulaire garde une étape par section). Piloté en amont
  /// (applyC1Improvements) ; consommé par buildMacroSteps. Prime sur
  /// stepPriority quand présent (mode macro = pas d'optional-collapse).
  stepGroup?: string;
  /// Champ dont la valeur est fixée automatiquement (defaultValue au montage
  /// du formulaire, et/ou dérivée juste avant soumission — cf.
  /// lib/pdf-forms/c1-motif-transfer.ts) : jamais rendu comme contrôle
  /// interactif dans les étapes (cf. `isAutoField`), mais reste sérialisé,
  /// validé et soumis normalement — DISTINCT de `hidden`, qui exclut aussi
  /// de la sérialisation publique et de la génération PDF. Utilisé pour
  /// `motifIntroduction` sur le C1 "changement de situation" : le motif
  /// reste réel et requis, mais l'utilisateur ne choisit plus parmi 4
  /// options — il choisit parmi les 5 chips concrets qui pilotent sa valeur.
  autoAnswered?: boolean;
  /// Champ dont la valeur se RECALCULE EN DIRECT à partir d'un autre champ du
  /// même formulaire (ex. date de naissance déduite du NISS). Contrairement à
  /// `autoAnswered`, le champ RESTE visible et normalement éditable — il ne se
  /// verrouille (lecture seule, valeur remplacée) que lorsque le champ source
  /// produit ACTUELLEMENT une valeur dérivée valide ; sinon l'utilisateur peut
  /// le remplir à la main (ex. NISS incomplet/absent). Consommé par
  /// `lib/pdf-forms/field-derivations.ts` (registre des fonctions de
  /// dérivation) et par le form-runner (calcul réactif + rendu verrouillé).
  derivedFrom?: { fieldId: string; via: FieldDerivation };
  /// Active l'autocomplete de rue belge (BeStAddress, ~144k rues, via
  /// `/api/lookup/search?tableSlug=code-rue`) sur un champ `text`.
  /// `postalFieldId` = id du champ code postal du MÊME formulaire : les
  /// suggestions dont le code postal correspond remontent en tête ; choisir
  /// une suggestion remplit aussi ce champ code postal en retour (cf.
  /// components/ui/street-autocomplete-input.tsx).
  streetAutocomplete?: { postalFieldId: string };
  /// Champ `iban` dont le compte n'est PAS forcément belge : utilise le
  /// validateur ISO 13616 générique (32 pays, cf. isValidInternationalIBAN)
  /// au lieu du validateur belge strict par défaut (BE + 14 chiffres).
  internationalIban?: boolean;
  /// Contrainte de groupe : « au moins un des champs partageant cette même
  /// clé (parmi les champs VISIBLES) doit être rempli/coché ». Aucun d'eux
  /// n'est individuellement `required` — utilisé quand la question porte sur
  /// un ENSEMBLE de choix plutôt qu'un champ unique (ex. les 5 chips
  /// "situation" du C1 : aucune n'est obligatoire seule, mais il en faut au
  /// moins une). L'erreur s'attache au premier champ visible du groupe.
  requiredGroup?: string;

  // Méta technique (non exposée au public)
  /// Note interne admin — JAMAIS exposée côté public.
  internalNote?: string;
  acroType?: AcroFieldType;
  readOnly?: boolean;
  /// Champ MASQUÉ du formulaire citoyen : jamais rendu (filtré au sérialiseur
  /// public) ni auto-injecté (date/signature) à la génération → reste BLANC
  /// dans le PDF. Pour les formulaires complétés en partie par un tiers (ex.
  /// C109/36-DIPLÔME, complété par l'école). Distinct de `readOnly` (grisé).
  hidden?: boolean;

  // ---- Champ `array` (lignes répétables) ----
  /// Schéma des champs d'une ligne. Seulement utilisé quand `type === "array"`.
  /// Les sous-champs ne supportent pas eux-mêmes le type "array" (1 seul niveau).
  itemFields?: PdfFormField[];
  /// Libellé affiché sur le bouton « + Ajouter ».
  addRowLabel?: Localized;
  /// Nombre minimum / maximum de lignes acceptées. Défaut : 0 / illimité.
  minRows?: number;
  maxRows?: number;
  /// Stamping positionnel d'un sous-champ de `array` : template du nom de
  /// widget AcroForm avec le placeholder `{index}` substitué par l'index de
  /// ligne 1-based. Exemple : `"{index} 1"` → `"1 1"` pour la 1ʳᵉ ligne,
  /// `"2 1"` pour la 2ᵉ, etc. Seuls les sous-champs qui portent ce template
  /// sont stampés ; les autres restent virtuels (capturés dans le payload
  /// mais sans cible PDF). Concrètement utilisé pour la grille des
  /// cohabitants du C1, qui expose 5 slots positionnels.
  pdfFieldNameTemplate?: string;
  /// Stamping « first-match » sur un champ `array` : la PREMIÈRE ligne qui
  /// satisfait `where` voit ses sous-champs déversés sur des widgets PDF
  /// uniques (typiquement les widgets « partenaire » du C1 qui n'existent
  /// qu'une fois sur le PDF mais dérivent de la ligne FAC du tableau).
  /// `fields` : map subFieldId → pdfFieldName.
  firstMatchMapping?: ArrayFirstMatchMapping;
}

/// Cf. `PdfFormField.firstMatchMapping`. La ligne qui satisfait `where` est
/// stampée sur les widgets désignés. Les checkboxes en pipe-séparateur
/// (`"oui_widget|non_widget"`) sont supportées pour les sous-champs `radio`.
export interface ArrayFirstMatchMapping {
  where: { fieldId: string; value: string | number | boolean };
  fields: Record<string, string>;
}

/// Valeur d'un champ `fullname` : deux sous-parties éditées côté front,
/// fusionnées en une seule chaîne au remplissage du PDF.
export interface FullNameValue {
  first?: string;
  last?: string;
}

/// Valeur d'une ligne d'un champ `array` — sous-payload.
export type FieldValueRecord = Record<string, FieldValueScalar>;
type FieldValueScalar = string | number | boolean | null | FullNameValue;
export type FieldValue = FieldValueScalar | FieldValueRecord[];
export type FormPayload = Record<string, FieldValue>;

/// Garde de type pour distinguer une valeur composite `fullname`.
export function isFullNameValue(v: unknown): v is FullNameValue {
  return typeof v === "object" && v !== null && !Array.isArray(v) && ("first" in v || "last" in v);
}

/// Garde de type pour distinguer une valeur composite `array`.
export function isFieldValueRecordArray(v: unknown): v is FieldValueRecord[] {
  return Array.isArray(v) && v.every((row) => typeof row === "object" && row !== null && !Array.isArray(row));
}

export interface ParsedPdf {
  fields: AcroFieldRaw[];
  pageCount: number;
  /// true si le PDF a au moins un champ AcroForm.
  hasAcroForm: boolean;
}

/// Déclencheur de sous-formulaire — porté par un PdfForm. Quand le payload
/// satisfait la règle, le PdfForm cible (identifié par `requiresFormSlug`) est
/// ajouté au parcours utilisateur dynamiquement.
///
/// Exemple (C1) :
/// ```
/// {
///   whenFieldId: "tremplinIndependants", whenValue: "oui",
///   unlessFieldId: "tremplinIndependantsDejaDeclare", unlessValue: "oui",
///   requiresFormSlug: "c1c",
///   reason: { fr: "Tremplin-indépendants à déclarer" }
/// }
/// ```
export interface PdfFormTrigger {
  /// Identifiant stable du champ déclencheur côté schéma enrichi.
  whenFieldId: string;
  /// Valeur attendue pour déclencher (comparaison stricte ===).
  whenValue: string | number | boolean;
  /// Champ d'exclusion : si défini ET égal à `unlessValue`, le trigger ne
  /// se déclenche pas. Typiquement le follow-up "déjà déclaré ?".
  unlessFieldId?: string;
  unlessValue?: string | number | boolean;
  /// Slug du PdfForm à ajouter au parcours (référence par slug, pas par id,
  /// pour rester stable à travers les ré-imports).
  requiresFormSlug: string;
  /// Explication pédagogique affichée à l'utilisateur (« Tu dois aussi… »).
  reason?: Localized;
}
