// ─────────────────────────────────────────────────────────────────────────
// REGISTRE UNIQUE DES LANGUES — source de vérité i18n du projet.
//
// ⚠️ Ajouter une langue = éditer CE SEUL fichier (+ créer messages/<loc>.json).
// Toutes les maps `Record<Locale, …>` vivent ici ; config / switcher / format /
// validateur / script de traduction importent depuis ce module (plus de
// duplication, plus d'oubli d'une map qui casse tsc).
//
// Aucune dépendance runtime (données pures) → importable côté client comme côté
// script Node, sans `server-only`.
// ─────────────────────────────────────────────────────────────────────────

/** Toutes les langues connues (FR = source + fallback universel). */
export const locales = [
  "fr",
  "nl",
  "de",
  "en",
  "it",
  "es",
  "pt",
  "ru",
  "sq",
  "mk",
  "ar",
  "tr",
  "ro",
  "bg",
] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Langues réellement proposées au public (UI traduite à 100 %). Les autres
 *  existent en code mais retombent sur FR → pas affichées dans le sélecteur. */
export const publicLocales: readonly Locale[] = [
  "fr",
  "nl",
  "en",
  "de",
  "it",
  "es",
  "pt",
  "ru",
  "sq",
  "mk",
  "tr",
  "ar",
];

/** Langues écrites de droite à gauche (le root layout applique `dir="rtl"`). */
export const rtlLocales: readonly Locale[] = ["ar"];

export function isRtl(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** Noms natifs (jamais traduits) — affichés dans le sélecteur de langue. */
export const localeNames: Record<Locale, string> = {
  fr: "Français",
  nl: "Nederlands",
  de: "Deutsch",
  en: "English",
  it: "Italiano",
  es: "Español",
  pt: "Português",
  ru: "Русский",
  sq: "Shqip",
  mk: "Македонски",
  ar: "العربية",
  tr: "Türkçe",
  ro: "Română",
  bg: "Български",
};

/** Code pays ISO 3166-1 alpha-2 pour les drapeaux `flag-icons` (`fi fi-xx`).
 *  Quelques langues → pays "porteur" : en→gb, ar→sa, sq→al (Albanie). */
export const localeCountryCodes: Record<Locale, string> = {
  fr: "fr",
  nl: "nl",
  de: "de",
  en: "gb",
  it: "it",
  es: "es",
  pt: "pt",
  ru: "ru",
  sq: "al",
  mk: "mk",
  ar: "sa",
  tr: "tr",
  ro: "ro",
  bg: "bg",
};

/** Tag BCP-47 à utiliser avec l'API `Intl`, adapté au contexte belge.
 *  fr/nl/de → variantes "-BE" ; en → "en-GB" ; ar générique ; autres = pays standard. */
export const localeTags: Record<Locale, string> = {
  fr: "fr-BE",
  nl: "nl-BE",
  de: "de-BE",
  en: "en-GB",
  it: "it-IT",
  es: "es-ES",
  pt: "pt-PT",
  ru: "ru-RU",
  sq: "sq-AL",
  mk: "mk-MK",
  ar: "ar",
  tr: "tr-TR",
  ro: "ro-RO",
  bg: "bg-BG",
};

/** Libellé FR de chaque langue cible, injecté dans les prompts de traduction IA
 *  (script UI + moteur de contenu DB). FR exclu (= source). Une langue absente
 *  d'ici est considérée NON traduisible par l'IA. */
export const aiLabels: Partial<Record<Locale, string>> = {
  nl: "néerlandais (Belgique)",
  de: "allemand",
  en: "anglais",
  it: "italien",
  es: "espagnol",
  pt: "portugais (Portugal, européen)",
  ru: "russe",
  sq: "albanais",
  mk: "macédonien",
  ar: "arabe standard moderne",
  tr: "turc",
  ro: "roumain",
  bg: "bulgare",
};

/** Une langue est traduisible par l'IA si elle n'est pas le FR et a un libellé. */
export function isTranslatableLocale(locale: string): boolean {
  return locale !== defaultLocale && locale in aiLabels;
}
