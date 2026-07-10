import { PdfFormField, Locale, PdfFormTrigger } from "./types";
import type { PdfForm } from "@prisma/client";

/// Vue publique d'un champ : on retire toute donnée interne admin
/// (`internalNote`) et les détails techniques inutiles côté front.
/// IMPOSSIBLE d'oublier : seul ce module expose les champs au public.
export interface PublicField {
  id: string;
  type: PdfFormField["type"];
  required: boolean;
  label: PdfFormField["label"];
  labelShort?: PdfFormField["labelShort"];
  help?: PdfFormField["help"];
  helpShort?: PdfFormField["helpShort"];
  placeholder?: PdfFormField["placeholder"];
  errorMsg?: PdfFormField["errorMsg"];
  options?: PdfFormField["options"];
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  regex?: string;
  defaultValue?: PdfFormField["defaultValue"];
  visibleIf?: PdfFormField["visibleIf"];
  visibleIfParent?: PdfFormField["visibleIfParent"];
  prefillFrom?: PdfFormField["prefillFrom"];
  nameOrder?: PdfFormField["nameOrder"];
  /// Si true côté schéma : champ informatif / géré ailleurs — interdit
  /// d'édition côté UI publique (eg. cotisation syndicale C1).
  readOnly?: boolean;
  section?: string;
  order?: number;
  renderAs?: PdfFormField["renderAs"];
  stepPriority?: PdfFormField["stepPriority"];
  stepGroup?: PdfFormField["stepGroup"];
  autoAnswered?: PdfFormField["autoAnswered"];
  derivedFrom?: PdfFormField["derivedFrom"];
  onSelectSet?: PdfFormField["onSelectSet"];
  streetAutocomplete?: PdfFormField["streetAutocomplete"];
  requireListMatch?: PdfFormField["requireListMatch"];
  countrySelect?: PdfFormField["countrySelect"];
  communeFrom?: PdfFormField["communeFrom"];
  internationalIban?: PdfFormField["internationalIban"];
  requiredGroup?: PdfFormField["requiredGroup"];
  /// Clé canonique — safe à exposer publiquement : c'est un identifiant
  /// sémantique du champ (ex. "identity.nom"), pas une donnée du citoyen.
  /// Le prefill croisé côté client s'en sert pour aligner deux formulaires
  /// enchaînés dans un même dossier.
  canonicalKey?: PdfFormField["canonicalKey"];
  // ---- Champ `array` ----
  itemFields?: PublicField[];
  addRowLabel?: PdfFormField["addRowLabel"];
  minRows?: number;
  maxRows?: number;
  pdfFieldNameTemplate?: PdfFormField["pdfFieldNameTemplate"];
  firstMatchMapping?: PdfFormField["firstMatchMapping"];
}

export function toPublicField(f: PdfFormField): PublicField {
  return {
    id: f.id,
    type: f.type,
    required: f.required,
    label: f.label,
    labelShort: f.labelShort,
    help: f.help,
    helpShort: f.helpShort,
    placeholder: f.placeholder,
    errorMsg: f.errorMsg,
    options: f.options,
    maxLength: f.maxLength,
    minLength: f.minLength,
    min: f.min,
    max: f.max,
    regex: f.regex,
    defaultValue: f.defaultValue,
    visibleIf: f.visibleIf,
    visibleIfParent: f.visibleIfParent,
    prefillFrom: f.prefillFrom,
    nameOrder: f.nameOrder,
    readOnly: f.readOnly,
    section: f.section,
    order: f.order,
    renderAs: f.renderAs,
    stepPriority: f.stepPriority,
    stepGroup: f.stepGroup,
    autoAnswered: f.autoAnswered,
    derivedFrom: f.derivedFrom,
    onSelectSet: f.onSelectSet,
    streetAutocomplete: f.streetAutocomplete,
    requireListMatch: f.requireListMatch,
    countrySelect: f.countrySelect,
    communeFrom: f.communeFrom,
    internationalIban: f.internationalIban,
    requiredGroup: f.requiredGroup,
    canonicalKey: f.canonicalKey,
    itemFields: f.itemFields ? f.itemFields.map(toPublicField) : undefined,
    addRowLabel: f.addRowLabel,
    minRows: f.minRows,
    maxRows: f.maxRows,
    pdfFieldNameTemplate: f.pdfFieldNameTemplate,
    firstMatchMapping: f.firstMatchMapping,
  };
}

export interface PublicForm {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  issuer: string | null;
  version: number;
  defaultLocale: Locale;
  locales: Locale[];
  allowDownload: boolean;
  allowDoccle: boolean;
  allowItsme: boolean;
  fields: PublicField[];
  /// Déclencheurs de sous-formulaires (cf. lib/pdf-forms/triggers.ts) — exposés
  /// pour permettre au runner d'annoncer en direct qu'une réponse ajoute un
  /// document (hors dossier : notice non bloquante ; dans un dossier : la
  /// matérialisation réelle vient du serveur, cf. Task 3 `newlyTriggered`).
  triggers: PdfFormTrigger[];
}

/// Sérialise un PdfForm (publié) pour le front. N'expose jamais le chemin de
/// stockage, le schéma technique, ni les notes internes.
export function toPublicForm(
  form: Pick<
    PdfForm,
    | "id" | "slug" | "title" | "description" | "issuer" | "version"
    | "defaultLocale" | "locales" | "allowDownload" | "allowDoccle" | "allowItsme" | "fields" | "triggers"
  >
): PublicForm {
  const fields = ((form.fields as unknown as PdfFormField[]) || [])
    // Les champs `hidden` (complétés par un tiers) ne sont jamais envoyés au
    // client : le citoyen ne les voit pas et ne les remplit pas.
    .filter((f) => !f.hidden)
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(toPublicField);

  return {
    id: form.id,
    slug: form.slug,
    title: form.title,
    description: form.description,
    issuer: form.issuer,
    version: form.version,
    defaultLocale: (form.defaultLocale as Locale) || "fr",
    locales: ((form.locales as unknown as Locale[]) || ["fr"]),
    allowDownload: form.allowDownload,
    allowDoccle: form.allowDoccle,
    allowItsme: form.allowItsme,
    fields,
    triggers: ((form.triggers as unknown as PdfFormTrigger[]) || []),
  };
}
