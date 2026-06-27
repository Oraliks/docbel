/**
 * Seed one-shot : importe docs/i18n-glossaire.md dans la table GlossaryTerm.
 * Idempotent prudent : ne fait rien si la table est déjà peuplée (pour ne pas
 * écraser les éditions faites via l'admin). Forcer avec --force.
 *
 * Lancer : npx tsx scripts/glossary-seed.ts   (ou --force)
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import path from "path";

const prisma = new PrismaClient();

const STRAT: Record<string, string> = {
  "🟢": "translate",
  "🟡": "translate_gloss",
  "🔴": "keep",
};

function detectStrategy(cell: string): string {
  for (const [emoji, val] of Object.entries(STRAT)) if (cell.includes(emoji)) return val;
  return "translate_gloss";
}
const clean = (s: string) => s.replace(/\*\*/g, "").trim();

async function main() {
  const force = process.argv.includes("--force");
  const existing = await prisma.glossaryTerm.count();
  if (existing > 0 && !force) {
    console.log(`GlossaryTerm déjà peuplé (${existing} termes) — seed sauté (--force pour forcer).`);
    return;
  }

  const md = readFileSync(path.join(process.cwd(), "docs", "i18n-glossaire.md"), "utf8");
  const lines = md.split(/\r?\n/);

  let category = "";
  let order = 0;
  const rows: {
    term: string;
    strategy: string;
    glossFr: string;
    note: string | null;
    category: string;
    order: number;
  }[] = [];

  for (const line of lines) {
    const h = line.match(/^##\s+[A-Z]\.\s+(.+)$/u);
    if (h) {
      category = h[1]
        .replace(/[🟢🟡🔴⚠️/]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
      continue;
    }
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 6) continue; // tables de glossaire = 4 colonnes (6 cellules)
    const term = clean(cells[1]);
    if (!term || term === "Terme" || /^:?-+:?$/.test(term)) continue;
    if (term.includes("TRADUIRE") || term.includes("GARDER")) continue; // légende
    const glossFr = cells[3] || "";
    if (!glossFr) continue;
    rows.push({
      term,
      strategy: detectStrategy(cells[2]),
      glossFr,
      note: cells[4] ? cells[4] : null,
      category,
      order: order++,
    });
  }

  if (force) await prisma.glossaryTerm.deleteMany({});
  await prisma.glossaryTerm.createMany({ data: rows });
  console.log(`Seedé ${rows.length} termes de glossaire.`);
  const byCat = rows.reduce<Record<string, number>>((a, r) => {
    a[r.category] = (a[r.category] ?? 0) + 1;
    return a;
  }, {});
  for (const [c, n] of Object.entries(byCat)) console.log(`  ${c}: ${n}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
