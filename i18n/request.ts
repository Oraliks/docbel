import { getRequestConfig } from "next-intl/server";
import { getUserLocale } from "./locale";
import { defaultLocale, type Locale } from "./config";

// Catalogues de messages importés STATIQUEMENT (un par locale connue).
// ⚠️ On évite volontairement `import(`../messages/${x}.json`)` : un import
// dynamique à chemin variable génère un "context module" qui embarque TOUT
// `messages/**/*.json` — y compris le dossier de staging `messages/_patch/`.
// Si un de ces fichiers est invalide (écriture concurrente d'un autre agent
// pendant un build), le build entier casse. Les imports statiques ne bundlent
// QUE les 10 fichiers listés ici → build immunisé contre les fichiers parasites.
import fr from "../messages/fr.json";
import nl from "../messages/nl.json";
import de from "../messages/de.json";
import en from "../messages/en.json";
import it from "../messages/it.json";
import es from "../messages/es.json";
import ar from "../messages/ar.json";
import tr from "../messages/tr.json";
import ro from "../messages/ro.json";
import bg from "../messages/bg.json";

const CATALOGS = { fr, nl, de, en, it, es, ar, tr, ro, bg } as Record<
  Locale,
  Record<string, unknown>
>;

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
  const base = CATALOGS[defaultLocale];
  const active = CATALOGS[locale as Locale] ?? base;
  const messages = locale === defaultLocale ? base : deepMerge(base, active);
  return { locale, messages };
});
