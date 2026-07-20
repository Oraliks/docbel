/**
 * Génère (bootstrap) les mappings « Codes ONEM liés » RioLex à partir des tables
 * Lookup elles-mêmes — pont STRUCTUREL, pas de détection en prose : les codes de
 * ces tables sont numérotés d'après l'article légal qu'ils implémentent
 * (ex. « Exclusion récidive article 153 », « article 30 », « art. 103-104 »).
 *
 * Pour chaque table ciblée, on groupe les codes par numéro d'article de tête,
 * et si `25_11_1991-1-art_<N>` existe (et n'est pas abrogé), on émet quelques
 * codes REPRÉSENTATIFS (base, sans variantes Y/Z avertissement/sursis) avec le
 * libellé ONEM réel. Résultat fusionné dans lib/data/riolex-lookup-refs.json en
 * PRÉSERVANT les clés déjà présentes (les sanctions 153/154/155 hand-authored
 * restent intactes). Idempotent. Ensuite : `pnpm attach:lookup-refs`.
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/generate-lookup-refs.ts
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import type { LegalMeta } from "@/components/reglementation/types";
import type { LookupCodeRef } from "@/lib/dossiers/types";

const MAP_PATH = join(process.cwd(), "lib/data/riolex-lookup-refs.json");
const LOI_PREFIX = "25_11_1991-1-art_";
const PER_ART = 5; // codes représentatifs max par article (l'encart en cap 12)

// Tables où le pont code#→article# tient (ordre = priorité d'affichage).
const TABLES = [
  "signaletic-sanction-article",
  "signaletic-admissibility-article",
  "s04-s36-article-indemnisation",
];

/** Numéro d'article de tête ("129&2A"->"129", "36BIS"->"36", "104,1"->"104"). */
function leadNum(code: string): string | null {
  const m = /^(\d+)/.exec(code.trim());
  return m ? m[1] : null;
}

// Abréviations ONEM de suffixe d'article -> forme RioLex.
const SUFFIX: Record<string, string> = {
  BIS: "bis", TER: "ter", QUATER: "quater", QTR: "quater",
  QUINQUIES: "quinquies", QUINQ: "quinquies", SEXIES: "sexies",
  SEPTIES: "septies", OCTIES: "octies", NONIES: "nonies", DECIES: "decies",
};

/**
 * Résout un code ONEM vers le riolexId de l'article ACTIF qu'il implémente.
 * Essaie d'abord le sous-article suffixé (129BIS -> art_129bis), puis l'article
 * de base ; renvoie le premier qui existe et n'est pas abrogé, sinon null.
 */
function resolveRid(code: string, validArts: Map<string, string>): string | null {
  const m = /^(\d+)\s*(BIS|TER|QUATER|QTR|QUINQUIES|QUINQ|SEXIES|SEPTIES|OCTIES|NONIES|DECIES)?/.exec(
    code.trim().toUpperCase(),
  );
  if (!m) return null;
  const base = `${LOI_PREFIX}${m[1]}`;
  const cands: string[] = [];
  if (m[2] && SUFFIX[m[2]]) cands.push(`${base}${SUFFIX[m[2]]}`);
  cands.push(base);
  for (const c of cands) if (validArts.has(c)) return c;
  return null;
}

/** Score de « simplicité » d'un code : plus bas = plus représentatif. */
function simplicity(code: string): number {
  const separators = (code.match(/[,&]/g) ?? []).length;
  const hasVariant = /[A-Z]$/.test(code) ? 1 : 0; // suffixe lettre (souvent variante)
  return code.length + separators * 4 + hasVariant * 2;
}

/** Variante procédurale à écarter (Y = avertissement, Z = sursis, N = non-admis). */
function isProceduralVariant(code: string): boolean {
  return /[YZ]$/.test(code.trim());
}

function cleanLabel(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (s.length <= 72) return s;
  const cut = s.slice(0, 72);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:]\s*$/, "") + "…";
}

async function main() {
  // 1) Articles RioLex existants (non abrogés) de l'AR 25.11.1991.
  const sources = await prisma.knowledgeSource.findMany({
    where: { domain: "chomage", enabled: true },
    select: { title: true, legalMeta: true },
    take: 5000,
  });
  const validArts = new Map<string, string>(); // riolexId -> title
  // Pseudo-articles méta (changelog « Liste des arrêtés modifiant… », art. 999) : jamais mappés.
  const META_RE = /liste des arr[êe]t[ée]s|dispositions?\s+modificatives?/i;
  for (const s of sources) {
    const m = (s.legalMeta ?? {}) as LegalMeta;
    if (!m.riolexId || m.isOnemCommentary === true || m.abroge === true) continue;
    if (META_RE.test(s.title)) continue;
    if (m.riolexId.startsWith(LOI_PREFIX)) validArts.set(m.riolexId, s.title);
  }

  // 2) Pour chaque table, grouper les codes par article de tête.
  const generated: Record<string, LookupCodeRef[]> = {};
  const report: string[] = [];

  for (const slug of TABLES) {
    const table = await prisma.lookupTable.findFirst({ where: { slug }, select: { id: true } });
    if (!table) { report.push(`(table absente: ${slug})`); continue; }
    const entries = await prisma.lookupEntry.findMany({
      where: { tableId: table.id },
      select: { code: true, labelFr: true },
    });

    const byRid = new Map<string, { code: string; labelFr: string }[]>();
    const skipped = new Set<string>();
    for (const e of entries) {
      if (isProceduralVariant(e.code)) continue;
      if (!e.labelFr || !e.labelFr.trim()) continue;
      const rid = resolveRid(e.code, validArts);
      if (!rid) { const n = leadNum(e.code); if (n) skipped.add(n); continue; }
      if (!byRid.has(rid)) byRid.set(rid, []);
      byRid.get(rid)!.push({ code: e.code, labelFr: e.labelFr });
    }

    let mapped = 0;
    for (const [rid, list] of byRid) {
      const chosen = list
        .slice()
        .sort((a, b) => simplicity(a.code) - simplicity(b.code))
        .slice(0, PER_ART)
        .map((e): LookupCodeRef => ({ tableSlug: slug, code: e.code, label: cleanLabel(e.labelFr) }));
      if (chosen.length === 0) continue;
      if (!generated[rid]) generated[rid] = [];
      generated[rid].push(...chosen);
      mapped++;
    }
    report.push(
      `${slug}: ${mapped} article(s) mappé(s) ; ${skipped.size} n° sans article RioLex actif (${[...skipped].sort((a,b)=>Number(a)-Number(b)).join(",")})`,
    );
  }

  // 3) Fusion NON destructive avec la carte existante (clés déjà présentes gardées).
  const existing = JSON.parse(readFileSync(MAP_PATH, "utf8")) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  // doc en tête
  out["__doc__"] =
    "Mappings « Codes ONEM liés » RioLex. Bootstrap via scripts/generate-lookup-refs.ts " +
    "(pont structurel code#→article#), éditable à la main ensuite. tableSlug = slug d'une " +
    "LookupTable. Clés '__' ignorées. Appliquer : pnpm attach:lookup-refs [--dry].";

  const articleKeys = new Set<string>();
  for (const [k, v] of Object.entries(existing)) {
    if (k.startsWith("__")) continue;
    out[k] = v; // conserve l'existant tel quel (sanctions hand-authored)
    articleKeys.add(k);
  }
  let added = 0;
  for (const [rid, refs] of Object.entries(generated)) {
    if (articleKeys.has(rid)) continue; // ne pas écraser une clé existante
    out[rid] = refs;
    articleKeys.add(rid);
    added++;
  }

  writeFileSync(MAP_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log("=== Génération mappings Lookup↔RioLex ===");
  for (const line of report) console.log("  " + line);
  console.log(`\n  Clés existantes conservées : ${Object.keys(existing).filter((k)=>!k.startsWith("__")).length}`);
  console.log(`  Nouvelles clés ajoutées    : ${added}`);
  console.log(`  Total articles mappés      : ${articleKeys.size}`);
  console.log(`\nÉcrit dans ${MAP_PATH}. Vérifie puis: pnpm attach:lookup-refs --dry`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
