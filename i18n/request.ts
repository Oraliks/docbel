import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "./locale";
import { defaultLocale } from "./config";

/**
 * Fusion profonde : on charge FR comme base puis on superpose la langue active.
 * Une clé non encore traduite retombe donc automatiquement sur le FR
 * → "informatif jamais bloquant", aucune clé manquante affichée.
 */
function deepMerge<T>(base: T, override: unknown): T {
  if (typeof base !== "object" || base === null) {
    return (override ?? base) as T;
  }
  const out: Record<string, unknown> = Array.isArray(base)
    ? ([...(base as unknown[])] as unknown as Record<string, unknown>)
    : { ...(base as Record<string, unknown>) };
  const ov = (override ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(ov)) {
    const b = (base as Record<string, unknown>)[key];
    const o = ov[key];
    out[key] =
      b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(b)
        ? deepMerge(b, o)
        : o;
  }
  return out as T;
}

export default getRequestConfig(async () => {
  const locale = await getUserLocale();
  const base = (await import(`../messages/${defaultLocale}.json`)).default;
  const messages =
    locale === defaultLocale
      ? base
      : deepMerge(base, (await import(`../messages/${locale}.json`)).default);
  return { locale, messages };
});
