// Configuration i18n centrale (mode cookie, sans routing URL pour l'admin).
// Les 8 langues sont figées ici ; l'activation/visibilité côté public se
// gérera plus tard via AppSetting. FR = langue source + fallback universel.

export const locales = ["fr", "nl", "de", "en", "ar", "tr", "ro", "bg"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "fr";

/** Langues écrites de droite à gauche (audit RTL des composants = phase ultérieure). */
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
  ar: "العربية",
  tr: "Türkçe",
  ro: "Română",
  bg: "Български",
};

/** Langues réellement proposées au public (UI traduite). Les autres existent en
 *  code mais retombent sur FR → on ne les affiche pas encore dans le sélecteur. */
export const publicLocales: readonly Locale[] = ["fr", "nl", "en"];

/** Nom du cookie qui mémorise la langue choisie par l'utilisateur. */
export const LOCALE_COOKIE = "BELDOC_LOCALE";
