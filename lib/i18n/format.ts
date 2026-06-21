// Helpers de formatage *locale-aware* centralisés (dates, nombres, devises).
//
// Pourquoi : le repo contient ~30 `toLocaleDateString('fr-BE')` et ~64
// `toLocaleString` avec une locale codée en dur. Ces helpers fournissent un
// point unique qui dérive le bon tag BCP-47 belge depuis notre `Locale`, pour
// que les futures features formatent dans la langue de l'utilisateur au lieu
// de figer "fr-BE".
//
// Usage selon le contexte :
//   - Composant SERVEUR  → passer `await getLocale()` (next-intl/server).
//       import { getLocale } from "next-intl/server";
//       const locale = await getLocale();
//       formatDate(dossier.createdAt, locale);
//   - Composant CLIENT   → passer `useLocale()` (next-intl).
//       const locale = useLocale();
//       formatDate(value, locale);
//
// Formatage déclaratif vs impératif :
//   next-intl expose `useFormatter()` (client) / `getFormatter()` (serveur)
//   pour le formatage déclaratif (et la config de formats partagés). Préfère-les
//   quand tu as déjà accès au formatter. CES helpers couvrent le cas impératif :
//   une `Date`/string/number brute à formater hors d'un contexte React, ou
//   quand passer la `Locale` explicitement est plus simple.
//
// Zéro dépendance hors `Intl` natif + `@/i18n/config`.

import { type Locale, isRtl } from "@/i18n/config";

/**
 * Tag BCP-47 à utiliser avec l'API `Intl`, adapté au contexte belge.
 * fr/nl/de → variantes "-BE" (formats locaux belges) ; en → "en-GB" (Europe) ;
 * ar gardé générique ; tr/ro/bg → tags pays standards.
 */
const LOCALE_TAGS: Record<Locale, string> = {
  fr: "fr-BE",
  nl: "nl-BE",
  de: "de-BE",
  en: "en-GB",
  ar: "ar",
  tr: "tr-TR",
  ro: "ro-RO",
  bg: "bg-BG",
};

/** Map une `Locale` vers son tag BCP-47 belge approprié pour `Intl`. */
export function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS.fr;
}

/** Indique si la locale s'écrit de droite à gauche (réexport pratique). */
export function isRtlLocale(locale: Locale): boolean {
  return isRtl(locale);
}

/**
 * Parse défensivement une entrée Date | string | number en `Date` valide.
 * Retourne `null` si la valeur est absente ou ne donne pas une date valide.
 */
function toValidDate(value: Date | string | number): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formate une date (sans heure par défaut). Accepte une `Date`, une string
 * (ISO…) ou un timestamp. Retourne "" si l'entrée est invalide.
 */
export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toValidDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat(localeTag(locale), options).format(date);
}

/**
 * Formate une date *avec* l'heure (jour + heure/minute par défaut).
 * Accepte `Date | string | number`. Retourne "" si l'entrée est invalide.
 */
export function formatDateTime(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toValidDate(value);
  if (!date) return "";
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
    ...options,
  };
  return new Intl.DateTimeFormat(localeTag(locale), opts).format(date);
}

/**
 * Formate un nombre selon la locale. Retourne "" si la valeur n'est pas un
 * nombre fini.
 */
export function formatNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat(localeTag(locale), options).format(value);
}

/**
 * Formate un montant en devise (EUR par défaut, contexte belge).
 * Retourne "" si la valeur n'est pas un nombre fini.
 */
export function formatCurrency(
  value: number,
  locale: Locale,
  currency = "EUR",
): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat(localeTag(locale), {
    style: "currency",
    currency,
  }).format(value);
}
