/**
 * Glossaire dérivé des articles de définition du corpus (AR art. 1 & 27,
 * AM art. 1 : « Pour l'application…, il faut entendre par : 1° terme : définition »).
 * Détecte les termes définis dans un article et propose leur définition + la
 * fiche source. Le parseur est pur/testé ; l'accès aux textes est mémoïsé en
 * mémoire (corpus quasi statique), zéro écriture DB.
 */

import { prisma } from "@/lib/prisma";
import { parseLegalText } from "./parse-legal-text";

export interface GlossaryEntry {
  term: string;
  definition: string;
  sourceRiolexId: string;
}

/** Nettoie un terme des marqueurs RioLex (« (3) », « {1} », « ❌ ») et ponctuation. */
function cleanTerm(raw: string): string {
  return raw
    .replace(/\{\d+\}/g, "")
    .replace(/❌/g, "")
    .replace(/\(\d+\)/g, "")
    .replace(/[;:.\s]+$/g, "")
    .trim();
}

/** Extrait les couples terme/définition d'un article de définitions. */
export function parseDefinitions(text: string, source: string): GlossaryEntry[] {
  const blocks = parseLegalText(text);
  const out: GlossaryEntry[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.type !== "list-item" || b.level !== 1) continue;
    const m = /^(.{2,70}?)\s*:\s*([\s\S]*)$/.exec(b.text);
    if (!m) continue;
    const term = cleanTerm(m[1]);
    let def = m[2].trim();
    // Termes à sous-items (« chômeur complet : a) … b) … ») → concatène.
    const subs: string[] = [];
    let j = i + 1;
    while (j < blocks.length && blocks[j].type === "list-item" && blocks[j].level === 2) {
      subs.push(`${blocks[j].marker} ${blocks[j].text}`);
      j++;
    }
    if (subs.length) def = (def ? `${def} ` : "") + subs.join(" ");
    def = def.replace(/^;+\s*/, "").trim();
    if (term.length >= 3 && def.length >= 3) {
      out.push({ term, definition: def, sourceRiolexId: source });
    }
  }
  return out;
}

/** Un terme est « distinctif » (assez rare pour un surlignage inline non bruyant). */
export function isDistinctive(term: string): boolean {
  return /\s/.test(term.trim()) || term.trim().length >= 14;
}

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "");

/** Entrées dont le terme apparaît dans un texte (distinctifs d'abord, cap `limit`). */
export function termsInText(
  entries: GlossaryEntry[],
  text: string,
  limit = 10,
): GlossaryEntry[] {
  const hay = norm(text ?? "");
  const present = entries.filter((e) => hay.includes(norm(e.term)));
  present.sort((a, b) => {
    const da = isDistinctive(a.term) ? 0 : 1;
    const db = isDistinctive(b.term) ? 0 : 1;
    return da - db || b.term.length - a.term.length;
  });
  // Dédup par terme normalisé.
  const seen = new Set<string>();
  const out: GlossaryEntry[] = [];
  for (const e of present) {
    const k = norm(e.term);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= limit) break;
  }
  return out;
}

// Sources globales de définitions (les plus larges du corpus).
const DEF_SOURCES = [
  "25_11_1991-1-art_1",
  "25_11_1991-1-art_27",
  "26_11_1991-1-art_1",
];

interface Cache {
  builtAt: number;
  entries: GlossaryEntry[];
}
let cache: Cache | null = null;
let building: Promise<GlossaryEntry[]> | null = null;
const TTL_MS = 1000 * 60 * 30;

async function build(): Promise<GlossaryEntry[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ content: string | null; rid: string | null }>
  >(
    `SELECT s."content" AS content, s."legalMeta"->>'riolexId' AS rid
     FROM "KnowledgeSource" s
     WHERE s."domain" = 'chomage' AND s."enabled" = true
       AND s."legalMeta"->>'riolexId' = ANY($1::text[])`,
    DEF_SOURCES,
  );
  const entries: GlossaryEntry[] = [];
  for (const r of rows) {
    if (r.rid) entries.push(...parseDefinitions(r.content ?? "", r.rid));
  }
  return entries;
}

/** Glossaire complet (fail-soft : [] si échec). */
export async function getGlossary(): Promise<GlossaryEntry[]> {
  if (!cache || Date.now() - cache.builtAt > TTL_MS) {
    if (!building) {
      building = build()
        .then((entries) => {
          cache = { builtAt: Date.now(), entries };
          building = null;
          return entries;
        })
        .catch((err) => {
          building = null;
          throw err;
        });
    }
    try {
      await building;
    } catch {
      return [];
    }
  }
  return cache?.entries ?? [];
}
