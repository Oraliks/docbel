/**
 * i18n-compile — matérialise les catalogues de messages FUSIONNÉS sur disque.
 *
 * Pour chaque locale : `deepMerge(fr, locale)` → `messages/_compiled/{locale}.json`
 * (catalogue complet, fallback FR figé). C'est exactement ce que le runtime
 * mémoïse au chargement (i18n/request.ts) : ce script écrit le même résultat
 * sur disque, utile pour
 *   - inspecter/differ le catalogue réellement servi par locale,
 *   - vérifier la parité de clés vs FR (rapport en fin),
 *   - disposer d'un artefact prêt si on active le precompile next-intl plus tard.
 *
 * Le runtime ne DÉPEND PAS de ces fichiers (pas de couplage build) : ils sont
 * un artefact (gitignoré). Lancer : `pnpm i18n:compile`.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";
import { locales, defaultLocale, type Locale } from "@/i18n/locales";

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const OUT_DIR = path.join(MESSAGES_DIR, "_compiled");

type Json = Record<string, unknown>;

function deepMerge<T>(base: T, override: unknown): T {
  if (typeof base !== "object" || base === null) return (override ?? base) as T;
  const out: Json = Array.isArray(base)
    ? ([...(base as unknown[])] as unknown as Json)
    : { ...(base as Json) };
  const ov = (override ?? {}) as Json;
  for (const key of Object.keys(ov)) {
    const b = (base as Json)[key];
    const o = ov[key];
    out[key] =
      b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(b)
        ? deepMerge(b, o)
        : o;
  }
  return out as T;
}

/** Compte récursif des clés feuilles (chaînes) d'un catalogue. */
function countLeaves(obj: unknown): number {
  if (typeof obj !== "object" || obj === null) return 1;
  if (Array.isArray(obj)) return 1;
  let n = 0;
  for (const v of Object.values(obj as Json)) n += countLeaves(v);
  return n;
}

/** Nb de feuilles encore identiques à la base FR (= non traduites). */
function countSameAsBase(base: unknown, cur: unknown): number {
  if (typeof base !== "object" || base === null || Array.isArray(base)) {
    return JSON.stringify(base) === JSON.stringify(cur) ? 1 : 0;
  }
  let n = 0;
  for (const [k, b] of Object.entries(base as Json)) {
    n += countSameAsBase(b, (cur as Json)?.[k]);
  }
  return n;
}

function load(locale: Locale): Json {
  return JSON.parse(readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8"));
}

function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const fr = load(defaultLocale);
  const total = countLeaves(fr);

  console.log(`i18n-compile — base ${defaultLocale}: ${total} clés feuilles\n`);
  for (const locale of locales) {
    const merged = locale === defaultLocale ? fr : deepMerge(fr, load(locale));
    writeFileSync(
      path.join(OUT_DIR, `${locale}.json`),
      JSON.stringify(merged, null, 2) + "\n",
      "utf8"
    );
    if (locale === defaultLocale) {
      console.log(`  ${locale}  (source)  ${total} clés`);
    } else {
      const same = countSameAsBase(fr, merged);
      const translated = total - same;
      const pct = ((translated / total) * 100).toFixed(1);
      console.log(
        `  ${locale.padEnd(3)} ${translated}/${total} traduites (${pct}%) · ${same} en fallback FR`
      );
    }
  }
  console.log(`\n→ écrit dans messages/_compiled/ (${locales.length} fichiers)`);
}

main();
