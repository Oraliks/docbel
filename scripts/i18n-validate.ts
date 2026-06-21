/**
 * i18n-validate.ts
 * -----------------
 * Validation des catalogues de traduction next-intl.
 *
 * Lancé via `tsx scripts/i18n-validate.ts`, branché en CI.
 *
 * Ce que fait le script :
 *   1. Charge et parse chaque `messages/*.json` (JSON invalide => erreur bloquante).
 *   2. Valide la syntaxe ICU de chaque chaîne feuille (pluriels / select / échappement).
 *      - Utilise `@formatjs/icu-messageformat-parser` si résolvable.
 *      - Sinon, repli sur une vérification structurelle (« mode dégradé »).
 *   3. Calcule la couverture de chaque locale vs `fr.json` (source de vérité).
 *      Les clés manquantes sont des AVERTISSEMENTS (le fallback FR couvre).
 *   4. Affiche un rapport clair puis sort avec le bon code :
 *      - exit(1) si JSON invalide OU erreur de syntaxe ICU,
 *      - exit(0) sinon.
 *
 * Dépendances : `fs` et `path` (Node) uniquement. Le parser ICU est optionnel.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Locale de référence : catalogue rempli, source de vérité pour la couverture. */
const SOURCE_LOCALE = "fr";

/** Locales attendues (ordre d'affichage du rapport). */
const LOCALES = ["fr", "nl", "de", "en", "ar", "tr", "ro", "bg"] as const;
type Locale = (typeof LOCALES)[number];

/** Dossier des catalogues, relatif à la racine du repo (= cwd de `tsx`). */
const MESSAGES_DIR = path.resolve(process.cwd(), "messages");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Valeur JSON arbitraire issue d'un catalogue. */
type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Une feuille string collectée par le walk : son chemin pointé et sa valeur. */
interface Leaf {
  /** Chemin de clés joint par des points, ex. `auth.login.title`. */
  path: string;
  /** Valeur textuelle de la feuille. */
  value: string;
}

/** Résultat du chargement+parse d'un catalogue. */
interface LoadedCatalogue {
  locale: Locale;
  /** Présent uniquement si le JSON a parsé sans erreur. */
  data?: Record<string, JsonValue>;
  /** Présent uniquement si le parse a échoué. */
  parseError?: string;
  /** `true` si le fichier est absent / illisible. */
  missing?: boolean;
}

/** Une erreur de syntaxe ICU localisée. */
interface IcuError {
  locale: Locale;
  keyPath: string;
  message: string;
}

/** Signature minimale du parser ICU importé dynamiquement. */
type IcuParse = (message: string) => unknown;

// ---------------------------------------------------------------------------
// Helper : walk récursif des feuilles string
// ---------------------------------------------------------------------------

/**
 * Parcourt récursivement un objet de messages et collecte toutes les
 * feuilles de type string sous forme `{ path, value }`.
 *
 * - Les objets imbriqués étendent le chemin pointé.
 * - Les tableaux sont indexés (`items.0`, `items.1`, …) — next-intl ne les
 *   utilise pas pour les messages, mais on reste robuste.
 * - Les feuilles non-string (number/boolean/null) sont ignorées : elles ne
 *   portent pas d'ICU et ne comptent pas dans la couverture textuelle.
 */
function collectLeaves(
  value: JsonValue,
  prefix = "",
  acc: Leaf[] = [],
): Leaf[] {
  if (typeof value === "string") {
    acc.push({ path: prefix, value });
    return acc;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const childPath = prefix ? `${prefix}.${index}` : String(index);
      collectLeaves(item, childPath, acc);
    });
    return acc;
  }

  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const childPath = prefix ? `${prefix}.${key}` : key;
      collectLeaves(child, childPath, acc);
    }
  }

  // number | boolean | null => ignoré (pas une feuille texte).
  return acc;
}

// ---------------------------------------------------------------------------
// Étape 1 — Chargement + parse JSON
// ---------------------------------------------------------------------------

/**
 * Lit et parse `messages/<locale>.json`.
 * Toute erreur (fichier absent, JSON malformé) est capturée et rapportée,
 * jamais propagée — on veut un rapport complet, pas un crash au premier souci.
 */
function loadCatalogue(locale: Locale): LoadedCatalogue {
  const filePath = path.join(MESSAGES_DIR, `${locale}.json`);

  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (err) {
    return {
      locale,
      missing: true,
      parseError: `Fichier illisible (${(err as Error).message})`,
    };
  }

  try {
    const data = JSON.parse(raw) as Record<string, JsonValue>;
    return { locale, data };
  } catch (err) {
    return { locale, parseError: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Étape 2 — Validation ICU
// ---------------------------------------------------------------------------

/**
 * Tente de charger le parser ICU officiel. Sous pnpm la dépendance peut ne
 * pas être hissée / installée : on retombe alors en « mode dégradé ».
 */
async function loadIcuParser(): Promise<IcuParse | null> {
  try {
    const mod = await import("@formatjs/icu-messageformat-parser");
    if (typeof mod.parse === "function") {
      return mod.parse as IcuParse;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Vérification structurelle de repli quand le parser ICU n'est pas dispo.
 *
 * Heuristiques volontairement conservatrices (on ne veut PAS de faux positifs
 * bloquants en CI) :
 *   - accolades `{` / `}` équilibrées,
 *   - tout bloc `{arg, plural|select|selectordinal, …}` a un argument non vide
 *     et est suivi d'au moins une accolade d'options.
 *
 * Retourne `null` si plausible, sinon un message d'erreur.
 */
function validateIcuStructural(message: string): string | null {
  // 1) Équilibrage des accolades en tenant compte de l'échappement ICU
  //    (une apostrophe simple échappe le caractère suivant : '{', '}', '#').
  let depth = 0;
  for (let i = 0; i < message.length; i += 1) {
    const ch = message[i];

    if (ch === "'") {
      const next = message[i + 1];
      // `''` => apostrophe littérale ; `'{`/`'}`/`'#` => caractère échappé.
      if (next === "'") {
        i += 1; // saute la seconde apostrophe
        continue;
      }
      if (next === "{" || next === "}" || next === "#") {
        i += 1; // saute le caractère échappé : il ne compte pas
        continue;
      }
      continue;
    }

    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth < 0) {
        return "Accolade fermante « } » sans ouvrante correspondante.";
      }
    }
  }
  if (depth !== 0) {
    return `Accolades déséquilibrées (${depth} accolade(s) non fermée(s)).`;
  }

  // 2) Plausibilité des blocs plural/select/selectordinal.
  //    On repère `{ arg , <kw> , …` et on contrôle arg + présence d'options.
  const blockRe = /\{\s*([^,{}]*?)\s*,\s*(plural|select|selectordinal)\b([^{]*)/g;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(message)) !== null) {
    const [, arg, keyword, rest] = match;
    if (!arg || !arg.trim()) {
      return `Bloc « ${keyword} » sans nom d'argument.`;
    }
    // Après `{arg, plural,` on attend au moins une option `clé{...}`.
    if (!rest.includes("{")) {
      return `Bloc « ${keyword} » pour « ${arg} » sans aucune option (ex. "one{…} other{…}").`;
    }
  }

  return null;
}

/**
 * Valide l'ICU d'une liste de feuilles pour une locale donnée.
 * Empile les erreurs trouvées dans `errors`.
 */
function validateLeavesIcu(
  locale: Locale,
  leaves: Leaf[],
  parser: IcuParse | null,
  errors: IcuError[],
): void {
  for (const leaf of leaves) {
    if (parser) {
      try {
        parser(leaf.value);
      } catch (err) {
        errors.push({
          locale,
          keyPath: leaf.path,
          message: (err as Error).message.split("\n")[0],
        });
      }
    } else {
      const structuralError = validateIcuStructural(leaf.value);
      if (structuralError) {
        errors.push({ locale, keyPath: leaf.path, message: structuralError });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Étape 3 — Couverture par locale
// ---------------------------------------------------------------------------

/** Statistiques de couverture d'une locale vs la source. */
interface Coverage {
  locale: Locale;
  total: number;
  present: number;
  missing: number;
  percent: number;
}

/**
 * Compare l'ensemble des chemins de feuilles d'une locale à ceux de la source.
 * Ne renvoie que des compteurs — on ne liste jamais les clés (volumineux).
 */
function computeCoverage(
  locale: Locale,
  sourcePaths: Set<string>,
  localePaths: Set<string>,
): Coverage {
  const total = sourcePaths.size;
  let present = 0;
  for (const key of sourcePaths) {
    if (localePaths.has(key)) present += 1;
  }
  const missing = total - present;
  const percent = total === 0 ? 100 : Math.round((present / total) * 100);
  return { locale, total, present, missing, percent };
}

// ---------------------------------------------------------------------------
// Rapport + orchestration
// ---------------------------------------------------------------------------

/** Petits utilitaires d'affichage (sans dépendance externe). */
const log = (msg = "") => console.log(msg);
const section = (title: string) => {
  log();
  log(`── ${title} ${"─".repeat(Math.max(0, 56 - title.length))}`);
};

async function main(): Promise<void> {
  log("Validation des catalogues i18n (next-intl)");
  log(`Dossier : ${MESSAGES_DIR}`);

  // -- Étape 1 : chargement -------------------------------------------------
  const catalogues = LOCALES.map(loadCatalogue);

  const jsonErrors = catalogues.filter((c) => c.parseError);
  const validCatalogues = catalogues.filter(
    (c): c is LoadedCatalogue & { data: Record<string, JsonValue> } =>
      Boolean(c.data),
  );

  section("1. Parse JSON");
  for (const cat of catalogues) {
    if (cat.parseError) {
      const tag = cat.missing ? "ABSENT" : "INVALIDE";
      log(`  [${tag}] ${cat.locale}.json — ${cat.parseError}`);
    } else {
      log(`  [OK]      ${cat.locale}.json`);
    }
  }

  // Indexe les feuilles de chaque catalogue valide (réutilisé étapes 2 et 3).
  const leavesByLocale = new Map<Locale, Leaf[]>();
  for (const cat of validCatalogues) {
    leavesByLocale.set(cat.locale, collectLeaves(cat.data));
  }

  // -- Étape 2 : ICU --------------------------------------------------------
  section("2. Syntaxe ICU");
  const parser = await loadIcuParser();
  const mode = parser
    ? "parser @formatjs/icu-messageformat-parser"
    : "mode dégradé (vérification structurelle — parser ICU non résolu)";
  log(`  Mode : ${mode}`);

  const icuErrors: IcuError[] = [];
  // On valide la source + toute locale effectivement remplie.
  for (const cat of validCatalogues) {
    const leaves = leavesByLocale.get(cat.locale) ?? [];
    if (leaves.length === 0) continue; // catalogue vide => rien à valider
    validateLeavesIcu(cat.locale, leaves, parser, icuErrors);
  }

  if (icuErrors.length === 0) {
    log("  Aucune erreur de syntaxe ICU détectée.");
  } else {
    log(`  ${icuErrors.length} erreur(s) ICU :`);
    for (const e of icuErrors) {
      log(`    [${e.locale}] ${e.keyPath} — ${e.message}`);
    }
  }

  // -- Étape 3 : couverture -------------------------------------------------
  section("3. Couverture vs source (fr)");

  const sourceLeaves = leavesByLocale.get(SOURCE_LOCALE);
  const coverages: Coverage[] = [];

  if (!sourceLeaves) {
    log(
      `  Impossible de calculer la couverture : ${SOURCE_LOCALE}.json absent ou invalide.`,
    );
  } else {
    const sourcePaths = new Set(sourceLeaves.map((l) => l.path));
    log(`  Source ${SOURCE_LOCALE}.json : ${sourcePaths.size} clés.`);
    log();

    for (const locale of LOCALES) {
      if (locale === SOURCE_LOCALE) continue;
      const leaves = leavesByLocale.get(locale);
      if (!leaves) {
        log(`  ${locale} : non évaluée (JSON absent ou invalide).`);
        continue;
      }
      const localePaths = new Set(leaves.map((l) => l.path));
      const cov = computeCoverage(locale, sourcePaths, localePaths);
      coverages.push(cov);
      const missingNote =
        cov.missing > 0
          ? ` — ${cov.missing} clé(s) manquante(s) [fallback FR]`
          : " — complète";
      log(
        `  ${locale} : ${cov.present}/${cov.total} clés (${cov.percent}%)${missingNote}`,
      );
    }
  }

  // -- Synthèse + exit ------------------------------------------------------
  section("Synthèse");

  const totalMissing = coverages.reduce((sum, c) => sum + c.missing, 0);
  const hasBlocking = jsonErrors.length > 0 || icuErrors.length > 0;

  log(`  JSON invalides / absents : ${jsonErrors.length}`);
  log(`  Erreurs de syntaxe ICU   : ${icuErrors.length}`);
  log(`  Clés manquantes (warn)   : ${totalMissing} (couvertes par fallback FR)`);
  log();

  if (hasBlocking) {
    log("  Résultat : ÉCHEC (erreurs bloquantes ci-dessus).");
    process.exit(1);
  }

  log("  Résultat : SUCCÈS (warnings non bloquants éventuels).");
  process.exit(0);
}

// Entrée : toute exception imprévue devient un échec bloquant explicite.
main().catch((err) => {
  console.error("Erreur inattendue durant la validation i18n :");
  console.error(err);
  process.exit(1);
});
