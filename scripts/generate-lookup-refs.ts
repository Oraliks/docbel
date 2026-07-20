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

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { prisma } from "@/lib/prisma";
import { normalizeLookupRefs } from "@/lib/reglementation/lookup-refs";
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

// Entrées rédigées à la main (libellés curés) : elles PRIMENT sur la génération
// et sont réinjectées telles quelles à chaque run (indépendant de l'état du fichier).
const SANCTION = "signaletic-sanction-article";
const HAND_AUTHORED: Record<string, LookupCodeRef[]> = {
  "25_11_1991-1-art_153": [
    { tableSlug: SANCTION, code: "153,1", label: "Exclusion — omission ou déclaration inexacte/incomplète" },
    { tableSlug: SANCTION, code: "153,2", label: "Idem 153,1 — base « chef de ménage / isolé » accordé à tort" },
    { tableSlug: SANCTION, code: "153,3", label: "Exclusion — récidive article 153" },
  ],
  "25_11_1991-1-art_154": [
    { tableSlug: SANCTION, code: "154,1", label: "Exclusion — abus de la carte de contrôle" },
    { tableSlug: SANCTION, code: "154,2", label: "Exclusion — récidive article 154" },
    { tableSlug: SANCTION, code: "154,3", label: "Exclusion — abus carte de contrôle (fait > 30/9/2006, mauvaise foi, art. 154 al. 3)" },
    { tableSlug: SANCTION, code: "154,4", label: "Exclusion — récidive art. 154 (fait après 30/9/2006, mauvaise foi)" },
  ],
  "25_11_1991-1-art_155": [
    { tableSlug: SANCTION, code: "155,1,1", label: "Exclusion — production de documents inexacts (avant le 01/10/2006)" },
    { tableSlug: SANCTION, code: "155,1,2", label: "Exclusion — fausse marque de pointage (avant le 01/10/2006)" },
    { tableSlug: SANCTION, code: "155,2", label: "Exclusion — récidive (documents inexacts / fausse marque de pointage)" },
  ],
};

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

  // 2bis) Pont THÉMATIQUE pour les tables non numérotées par article (dispo S38,
  // vérification V) : rattachées en lien « table entière » (sans code) aux articles
  // dont le TITRE porte le thème — c'est la donnée qui décide, pas une invention.
  // Libellé éditorial court (renommage du label ONEM, pas d'affirmation réglementaire).
  const THEME_LABELS: Record<string, string> = {
    "dispo-state": "Disponibilité — statuts",
    "dispo-action-nature": "Disponibilité — nature des actions",
    "dispo-state-reason": "Disponibilité — motifs de statut",
    "dispo-early-end-reason": "Disponibilité — motifs de fin anticipée",
    "verif-decision-code": "Vérification — codes de décision",
    "codes-verification-preliminaire": "Codes de vérification préliminaire",
    "verif-day-nature-drs": "Vérification — nature des jours (DRS)",
    "verif-compensatory-rest-day": "Vérification — jours de repos compensatoire",
    "verif168bis-rejection": "Vérification — rejets art. 168bis",
  };
  const THEMES: { titleRe: RegExp; slugs: string[] }[] = [
    { titleRe: /disponibilit/i, slugs: ["dispo-state", "dispo-action-nature", "dispo-state-reason", "dispo-early-end-reason"] },
    { titleRe: /introduction et v[ée]rification/i, slugs: ["verif-decision-code", "codes-verification-preliminaire", "verif-day-nature-drs", "verif-compensatory-rest-day"] },
    { titleRe: /surveillance/i, slugs: ["verif-decision-code", "codes-verification-preliminaire"] },
    { titleRe: /r[ée]vision d.une d[ée]cision/i, slugs: ["verif-decision-code"] },
  ];
  const EXACT: { rid: string; slug: string }[] = [
    { rid: "25_11_1991-1-art_168bis", slug: "verif168bis-rejection" },
  ];

  const allSlugs = new Set(
    (await prisma.lookupTable.findMany({ select: { slug: true } })).map((t) => t.slug),
  );
  const addTableRef = (rid: string, slug: string) => {
    if (!allSlugs.has(slug)) return;
    if (!generated[rid]) generated[rid] = [];
    generated[rid].push({ tableSlug: slug, label: THEME_LABELS[slug] ?? slug });
  };
  let thematic = 0;
  for (const [rid, title] of validArts) {
    for (const th of THEMES) {
      if (!th.titleRe.test(title)) continue;
      for (const slug of th.slugs) { addTableRef(rid, slug); thematic++; }
    }
  }
  for (const ex of EXACT) {
    if (validArts.has(ex.rid)) { addTableRef(ex.rid, ex.slug); thematic++; }
  }
  report.push(`thématique dispo/verif : ${thematic} lien(s) « table entière » ajouté(s)`);

  // 3) Assemblage déterministe : hand-authored (priment) + généré (tout le reste).
  const out: Record<string, unknown> = {};
  out["__doc__"] =
    "Mappings « Codes ONEM liés » RioLex. Généré par scripts/generate-lookup-refs.ts " +
    "(pont code#→article# + thématique dispo/verif par titre), éditable à la main ensuite. " +
    "tableSlug = slug d'une LookupTable. Clés '__' ignorées. Appliquer : pnpm attach:lookup-refs [--dry].";

  const articleKeys = new Set<string>();
  for (const [rid, refs] of Object.entries(HAND_AUTHORED)) {
    out[rid] = refs;
    articleKeys.add(rid);
  }
  let added = 0;
  for (const [rid, refs] of Object.entries(generated)) {
    if (articleKeys.has(rid)) continue; // hand-authored prime
    const clean = normalizeLookupRefs(refs); // dédup (tableSlug,code) + cap 12
    if (clean.length === 0) continue;
    out[rid] = clean;
    articleKeys.add(rid);
    added++;
  }

  writeFileSync(MAP_PATH, JSON.stringify(out, null, 2) + "\n", "utf8");

  console.log("=== Génération mappings Lookup↔RioLex ===");
  for (const line of report) console.log("  " + line);
  console.log(`\n  Hand-authored (sanctions) : ${Object.keys(HAND_AUTHORED).length}`);
  console.log(`  Générés (code + thématique): ${added}`);
  console.log(`  Total articles mappés      : ${articleKeys.size}`);
  console.log(`\nÉcrit dans ${MAP_PATH}. Vérifie puis: pnpm attach:lookup-refs --dry`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
