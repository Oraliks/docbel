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

import { type Locale, isRtl, localeTags } from "@/i18n/locales";

/** Map une `Locale` vers son tag BCP-47 belge approprié pour `Intl`
 *  (registre `i18n/locales.ts`). */
export function localeTag(locale: Locale): string {
  return localeTags[locale] ?? localeTags.fr;
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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Convention DocBel (Oraliks 2026-07-10) : dates numériques FIXES en
 * JJ/MM/AAAA, INDÉPENDANTES de la langue de l'UI (un document administratif
 * belge s'écrit pareil en fr/nl/en/ar…). Volontairement pas `Intl` : certaines
 * locales du registre (de/ru/tr/ro/bg) séparent par des points, et `ar` peut
 * rendre des chiffres arabo-indiens — construction manuelle = déterministe.
 */
function formatFixedDate(date: Date): string {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Heure fixe 24h `HH:mm` (même convention — jamais de AM/PM). */
function formatFixedTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Formate une date (sans heure par défaut). Accepte une `Date`, une string
 * (ISO…) ou un timestamp. Retourne "" si l'entrée est invalide.
 *
 * Sans `options` → format FIXE JJ/MM/AAAA (convention DocBel, cf.
 * `formatFixedDate`). Passer des `options` explicites pour un rendu
 * alternatif volontairement locale-aware (ex. `{ day: "numeric", month:
 * "long" }` → "10 juillet 2026" pour un article) — `locale` ne sert qu'à ce
 * cas-là.
 */
export function formatDate(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toValidDate(value);
  if (!date) return "";
  if (!options) return formatFixedDate(date);
  return new Intl.DateTimeFormat(localeTag(locale), options).format(date);
}

/**
 * Formate une date *avec* l'heure. Accepte `Date | string | number`.
 * Retourne "" si l'entrée est invalide.
 *
 * Sans `options` → format FIXE "JJ/MM/AAAA HH:mm" (24h, convention DocBel).
 * Avec `options` → rendu `Intl` locale-aware, mais l'heure reste 24h par
 * défaut (`hourCycle: "h23"` injecté avant `options` — jamais de AM/PM,
 * remplaçable seulement par un override explicite dans `options`).
 */
export function formatDateTime(
  value: Date | string | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = toValidDate(value);
  if (!date) return "";
  if (!options) return `${formatFixedDate(date)} ${formatFixedTime(date)}`;
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
    hour12: false,
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
