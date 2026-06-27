/**
 * Traduit les clés UI publiques (public.*) de messages/fr.json vers les langues
 * cibles, en réutilisant le glossaire belge (table GlossaryTerm) injecté dans le
 * prompt de Claude. Écrit dans messages/<loc>.json.
 *
 * - Source = FR (matière chômage belge). Préserve ICU {var}/pluriels + balises.
 * - REPRENABLE : ne traduit que les clés manquantes, écrit après chaque lot.
 * - Concurrence limitée + retries (429/5xx/timeout).
 *
 * Lancer :  npx tsx scripts/i18n-translate-ui.ts [de it es tr ar]
 * (sans argument → de it es tr ar)
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { parse as parseICU, TYPE } from "@formatjs/icu-messageformat-parser";

const MESSAGES = path.join(process.cwd(), "messages");
// Sonnet 4.6 → supporte les sorties structurées (output_config.format), qui
// garantissent un JSON valide (fini les échecs de parse sur caractères non
// échappés). Schéma INDEXÉ fixe → compilé une fois, mis en cache 24 h.
const MODEL = "claude-sonnet-4-6";
const BATCH = Number(process.env.I18N_BATCH) || 20; // I18N_BATCH=8 pour les valeurs longues (anti-troncature)
const CONCURRENCY = Number(process.env.I18N_CC) || 4;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    translations: {
      type: "array",
      items: {
        type: "object",
        properties: { i: { type: "integer" }, text: { type: "string" } },
        required: ["i", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["translations"],
  additionalProperties: false,
} as const;

const LANG_LABEL: Record<string, string> = {
  de: "allemand",
  it: "italien",
  es: "espagnol",
  pt: "portugais (Portugal, européen)",
  ru: "russe",
  tr: "turc",
  ar: "arabe standard moderne",
};

// --- Clé API depuis .env.local (Claude Code injecte une clé vide dans l'env) ---
function readApiKey(): string {
  const env = readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
  const m = env.match(/^ANTHROPIC_API_KEY\s*=\s*["']?([^"'\r\n]+)/m);
  if (!m) throw new Error("ANTHROPIC_API_KEY introuvable dans .env.local");
  return m[1].trim();
}
const API_KEY = readApiKey();

// --- Helpers JSON imbriqué ---
type Json = Record<string, unknown>;
function flatten(obj: Json, pre = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[pre + k] = v;
    else if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flatten(v as Json, pre + k + "."));
  }
  return out;
}
function setNested(obj: Json, dotted: string, value: string) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]] as Json;
  }
  cur[parts[parts.length - 1]] = value;
}
/** Réordonne `data` pour suivre l'ordre des clés de `template` (récursif). */
function reorderLike(template: Json, data: Json): Json {
  const out: Json = {};
  for (const k of Object.keys(template)) {
    const tv = template[k];
    const dv = data[k];
    if (tv && typeof tv === "object" && !Array.isArray(tv)) {
      if (dv && typeof dv === "object") out[k] = reorderLike(tv as Json, dv as Json);
    } else if (dv !== undefined) {
      out[k] = dv;
    }
  }
  // garde d'éventuelles clés hors-template déjà présentes (ex. baremes legacy)
  for (const k of Object.keys(data)) if (!(k in out)) out[k] = data[k];
  return out;
}

// --- Validation ICU / balises (via AST @formatjs) ---
// On extrait les VRAIS noms d'arguments + balises depuis l'arbre ICU. Le texte
// des branches de pluriel/select (qui change forcément entre langues) est ignoré
// → pas de faux rejet. La trad doit : mêmes args, mêmes balises, et parser en ICU.
type IcuEl = {
  type: number;
  value?: string;
  options?: Record<string, { value: IcuEl[] }>;
  children?: IcuEl[];
};
function extractMeta(s: string): { args: string; tags: string } {
  const args = new Set<string>();
  const tagSet = new Set<string>();
  const walk = (els: IcuEl[]): void => {
    for (const el of els) {
      switch (el.type) {
        case TYPE.argument:
        case TYPE.number:
        case TYPE.date:
        case TYPE.time:
          if (el.value) args.add(el.value);
          break;
        case TYPE.select:
        case TYPE.plural:
          if (el.value) args.add(el.value);
          for (const opt of Object.values(el.options ?? {})) walk(opt.value);
          break;
        case TYPE.tag:
          if (el.value) tagSet.add(el.value);
          walk(el.children ?? []);
          break;
      }
    }
  };
  walk(parseICU(s) as IcuEl[]);
  return { args: [...args].sort().join(","), tags: [...tagSet].sort().join(",") };
}
// I18N_RELAX=1 : mode souple pour les sources à apostrophes françaises collées
// aux balises/variables (L'<strong>, l''horaire…) — l'apostrophe = délimiteur
// de citation ICU corrompt la détection args/balises → on accepte alors toute
// trad qui PARSE en ICU valide (on garde juste le garde-fou syntaxe).
const RELAX = process.env.I18N_RELAX === "1";
function icuValid(src: string, tr: string): boolean {
  let t: { args: string; tags: string };
  try {
    t = extractMeta(tr);
  } catch {
    return false; // la trad a cassé l'ICU (garde-fou syntaxe, même en relax)
  }
  if (RELAX) return true;
  let s: { args: string; tags: string };
  try {
    s = extractMeta(src);
  } catch {
    return true; // source non-ICU parsable → on ne sur-valide pas
  }
  return s.args === t.args && s.tags === t.tags;
}

// --- Glossaire depuis la DB ---
const STRAT_LABEL: Record<string, string> = {
  translate: "traduire",
  translate_gloss: "traduire + glose belge",
  keep: "garder le terme FR + glose",
};
async function loadGlossary(prisma: PrismaClient): Promise<string> {
  const terms = await prisma.glossaryTerm.findMany({ orderBy: { order: "asc" } });
  if (terms.length === 0) return "";
  const byCat = new Map<string, typeof terms>();
  for (const t of terms) {
    const c = t.category || "Divers";
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(t);
  }
  const blocks: string[] = [];
  for (const [cat, list] of byCat) {
    const items = list.map((t) => {
      const strat = STRAT_LABEL[t.strategy] ?? t.strategy;
      return `- ${t.term} [${strat}] : ${t.glossFr}${t.note ? ` — ${t.note}` : ""}`;
    });
    blocks.push(`## ${cat}\n${items.join("\n")}`);
  }
  return blocks.join("\n\n");
}

// --- Appel Claude (system caché, sortie structurée) avec retries ---
async function callClaude(system: string, user: string): Promise<string> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 12000,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
          output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        }),
        signal: AbortSignal.timeout(150_000),
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
      const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
      return (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("").trim();
    } catch (e) {
      if (attempt === 4) throw e;
      await new Promise((r) => setTimeout(r, attempt * 2500));
    }
  }
  throw new Error("unreachable");
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const prisma = new PrismaClient();
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
  const targets = args.filter((a) => a in LANG_LABEL);
  const LANGS = targets.length ? targets : ["de", "it", "es", "tr", "ar"];

  const glossary = await loadGlossary(prisma);
  await prisma.$disconnect();
  console.log(`Glossaire : ${glossary ? glossary.split("\n").filter((l) => l.startsWith("- ")).length + " termes" : "vide"}`);

  const fr = JSON.parse(readFileSync(path.join(MESSAGES, "fr.json"), "utf8")) as Json;
  const frPub = flatten((fr.public ?? {}) as Json);
  const frKeys = Object.keys(frPub);

  for (const loc of LANGS) {
    const label = LANG_LABEL[loc];
    const fp = path.join(MESSAGES, `${loc}.json`);
    const data: Json = existsSync(fp) ? JSON.parse(readFileSync(fp, "utf8")) : {};
    if (typeof data.public !== "object" || data.public === null) data.public = {};
    const existing = flatten(data.public as Json);

    const allMissing = frKeys.filter((k) => !(typeof existing[k] === "string" && (existing[k] as string).trim()));
    const missing = Number.isFinite(LIMIT) ? allMissing.slice(0, LIMIT) : allMissing;
    console.log(`\n=== ${loc} (${label}) : ${missing.length}/${allMissing.length} à traduire ===`);
    if (missing.length === 0) continue;

    const system = [
      `Tu es un traducteur professionnel spécialisé dans l'administration sociale belge`,
      `(chômage, ONEM/RVA, CPAS/OCMW, emploi, syndicats). Tu traduis des chaînes d'INTERFACE`,
      `depuis le FRANÇAIS vers le ${label}.`,
      ``,
      `RÈGLES STRICTES :`,
      `- Traduis fidèlement et naturellement, registre clair et accessible (UI grand public).`,
      `- Terminologie OFFICIELLE belge : respecte le glossaire ci-dessous (noms d'institutions, sigles).`,
      `- Préserve EXACTEMENT, SANS LES TRADUIRE NI LES SUPPRIMER :`,
      `  · les variables ICU entre accolades : {name}, {count}, et les pluriels`,
      `    {count, plural, one {...} other {...}} (adapte les catégories de pluriel à la langue cible`,
      `    mais garde le nom de variable et la syntaxe ICU).`,
      `  · les balises type HTML : <b>…</b>, <link>…</link>, <br/>.`,
      `  · les retours à la ligne, l'espacement de structure.`,
      `- Ne traduis PAS les clés JSON (à gauche), seulement les valeurs.`,
      loc === "ar" ? `- Écris en arabe standard moderne ; le sens de lecture (RTL) est géré par l'application.` : ``,
      ``,
      `SORTIE : un objet {"translations":[{"i":<index d'entrée>,"text":"<traduction>"}]},`,
      `un élément par chaîne d'entrée, même index. Traduis la valeur "fr" de chaque élément.`,
      glossary ? `\n=== GLOSSAIRE TERMINOLOGIQUE ===\n${glossary}` : ``,
    ].join("\n");

    const batches = chunk(missing, BATCH);
    let done = 0;
    let fallbacks = 0;

    // Pool de concurrence : traite les lots par vagues de CONCURRENCY.
    // I/O indexé ({i, fr} → {i, text}) + sortie structurée = JSON toujours valide.
    for (const wave of chunk(batches, CONCURRENCY)) {
      const results = await Promise.all(
        wave.map(async (keys) => {
          const payload = keys.map((k, i) => ({ i, fr: frPub[k] }));
          const user =
            `Traduis ces ${keys.length} chaînes d'UI du français vers le ${label}. ` +
            `Renvoie {"translations":[{"i":<index>,"text":"<traduction>"}]} avec le même index qu'en entrée.\n\n` +
            JSON.stringify(payload, null, 0);
          const out: Record<string, string> = {};
          try {
            const parsed = JSON.parse(await callClaude(system, user)) as {
              translations?: Array<{ i: number; text: string }>;
            };
            for (const item of parsed.translations ?? []) {
              const key = keys[item.i];
              if (key !== undefined && typeof item.text === "string") out[key] = item.text;
            }
          } catch (e) {
            console.error(`  lot ${loc} échoué (${(e as Error).message}) — réessai au prochain run`);
          }
          return { keys, out };
        })
      );

      for (const { keys, out } of results) {
        for (const k of keys) {
          const tr = out[k];
          if (typeof tr === "string" && tr.trim() && icuValid(frPub[k], tr)) {
            setNested(data.public as Json, k, tr);
            done++;
          } else if (typeof tr === "string" && tr.trim()) {
            // ICU/balise cassée → on garde le FR (fallback sûr), à re-tenter plus tard
            fallbacks++;
          }
        }
      }
      // Écrit après chaque vague (reprise sûre).
      data.public = reorderLike((fr.public ?? {}) as Json, data.public as Json);
      writeFileSync(fp, JSON.stringify(data, null, 2) + "\n", "utf8");
      process.stdout.write(`  ${loc}: ${done}/${missing.length} traduites (${fallbacks} fallback ICU)\r`);
    }
    console.log(`\n  ${loc} ✓ ${done} traduites${fallbacks ? `, ${fallbacks} fallback ICU (FR conservé)` : ""}`);
  }

  console.log("\nTerminé.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
