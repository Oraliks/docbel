// Dump du CONTENU DB traduisible (champs scalaires visibles au front).
//   private/i18n-content-dump/records/<Model>.json   → [{ id, field, value }] (pour le seed)
//   private/i18n-content-dump/translate/<Model>.json → [{ fr, nl:"", en:"" }] uniques (agents remplissent)
// Dédoublonnage par modèle : chaque chaîne FR n'est traduite qu'une fois.
// Read-only DB. private/ est hors git.
import { prisma } from "@/lib/prisma";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "private", "i18n-content-dump");
const RECORDS = path.join(ROOT, "records");
const TRANSLATE = path.join(ROOT, "translate");
mkdirSync(RECORDS, { recursive: true });
mkdirSync(TRANSLATE, { recursive: true });

type Entry = { id: string; field: string; value: string };

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

async function dump(model: string, rows: Array<Record<string, unknown>>, fields: string[]) {
  const out: Entry[] = [];
  const uniques = new Map<string, { fr: string; nl: string; en: string }>();
  for (const r of rows) {
    for (const f of fields) {
      const v = clean(r[f]);
      if (!v) continue;
      out.push({ id: String(r.id), field: f, value: v });
      if (!uniques.has(v)) uniques.set(v, { fr: v, nl: "", en: "" });
    }
  }
  writeFileSync(path.join(RECORDS, `${model}.json`), JSON.stringify(out, null, 2));
  const list = [...uniques.values()];
  writeFileSync(path.join(TRANSLATE, `${model}.json`), JSON.stringify(list, null, 2));
  const words = list.reduce((a, x) => a + x.fr.split(/\s+/).filter(Boolean).length, 0);
  console.log(
    `${model.padEnd(20)} ${String(out.length).padStart(5)} champs → ${String(list.length).padStart(4)} uniques | ~${words} mots à traduire`,
  );
  return { model, fields: out.length, uniques: list.length, words };
}

async function main() {
  const stats = [];
  stats.push(await dump("News", await prisma.news.findMany(), ["title", "excerpt", "content", "keyTakeaway"]));
  stats.push(await dump("Tool", await prisma.tool.findMany(), ["name", "description"]));
  stats.push(await dump("Organisme", await prisma.organisme.findMany(), ["name", "description"]));
  stats.push(await dump("CalculatorAsset", await prisma.calculatorAsset.findMany(), ["label", "description"]));
  stats.push(await dump("CommissionParitaire", await prisma.commissionParitaire.findMany(), ["nom", "label"]));
  stats.push(await dump("DocumentBundle", await prisma.documentBundle.findMany(), ["name", "description", "organism"]));
  stats.push(await dump("Bureau", await prisma.bureau.findMany(), ["hoursNotes"]));

  const totalUniques = stats.reduce((a, s) => a + s.uniques, 0);
  const totalWords = stats.reduce((a, s) => a + s.words, 0);
  console.log("─".repeat(72));
  console.log(`TOTAL ${String(totalUniques).padStart(4)} uniques à traduire | ~${totalWords} mots (×2 langues NL+EN)`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
