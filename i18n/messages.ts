import { defaultLocale, type Locale } from "./config";

type Messages = Record<string, unknown>;

// Chemins explicites : exclure les fichiers de staging messages/_patch.
// Chaque catalogue est chargé seulement à la première demande de sa langue.
const loaders = {
  fr: () => import("../messages/fr.json").then((module) => module.default),
  nl: () => import("../messages/nl.json").then((module) => module.default),
  de: () => import("../messages/de.json").then((module) => module.default),
  en: () => import("../messages/en.json").then((module) => module.default),
  it: () => import("../messages/it.json").then((module) => module.default),
  es: () => import("../messages/es.json").then((module) => module.default),
  pt: () => import("../messages/pt.json").then((module) => module.default),
  ru: () => import("../messages/ru.json").then((module) => module.default),
  sq: () => import("../messages/sq.json").then((module) => module.default),
  mk: () => import("../messages/mk.json").then((module) => module.default),
  ar: () => import("../messages/ar.json").then((module) => module.default),
  tr: () => import("../messages/tr.json").then((module) => module.default),
  ro: () => import("../messages/ro.json").then((module) => module.default),
  bg: () => import("../messages/bg.json").then((module) => module.default),
} satisfies Record<Locale, () => Promise<Messages>>;

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

// Cache borné par le registre des langues, pour les messages statiques seuls.
// Les requêtes concurrentes partagent également la fusion en cours.
const merged = new Map<Locale, Promise<Messages>>();

export function loadMessages(locale: Locale): Promise<Messages> {
  const existing = merged.get(locale);
  if (existing) return existing;

  const pending: Promise<Messages> = (locale === defaultLocale
    ? loaders[defaultLocale]()
    : Promise.all([loadMessages(defaultLocale), loaders[locale]()]).then(
        ([base, override]) => deepMerge(base, override),
      )
  ).catch((error: unknown) => {
    merged.delete(locale);
    throw error;
  });
  merged.set(locale, pending);
  return pending;
}
