// Seed ContentTranslation depuis private/i18n-content-dump/{records,done}.
// - done/<Model>[.pN].json : uniques traduits [{ fr, nl, en, note? }]
// - records/<Model>.json   : [{ id, field, value }] (FR source)
// On ré-associe par valeur FR → upsert (model, recordId, field, locale)→value.
// Idempotent : createMany skipDuplicates (1er seed) ; re-run = no-op.
import { prisma } from "@/lib/prisma";
import { readFileSync, readdirSync } from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "private", "i18n-content-dump");
const RECORDS = path.join(ROOT, "records");
const DONE = path.join(ROOT, "done");

type Tr = { fr: string; nl?: string; en?: string; note?: string };
type Rec = { id: string; field: string; value: string };
const LOCALES = ["nl", "en"] as const;

// "CommissionParitaire.p1.json" → "CommissionParitaire" ; "News.json" → "News"
const modelOf = (file: string) =>
  file.replace(/\.p\d+\.json$/, "").replace(/\.json$/, "");

async function main() {
  // 1. Catalogue de traductions par modèle : Map<model, Map<fr, Tr>>
  const byModel = new Map<string, Map<string, Tr>>();
  let emptyVals = 0;
  let flagged = 0;
  for (const file of readdirSync(DONE).filter((f) => f.endsWith(".json"))) {
    const model = modelOf(file);
    const arr = JSON.parse(readFileSync(path.join(DONE, file), "utf8")) as Tr[];
    let m = byModel.get(model);
    if (!m) {
      m = new Map();
      byModel.set(model, m);
    }
    for (const t of arr) {
      if (!t.nl?.trim() || !t.en?.trim()) emptyVals++;
      if (t.note) flagged++;
      m.set(t.fr, t);
    }
  }
  console.log(`Modèles traduits : ${[...byModel.keys()].join(", ")}`);
  console.log(`⚠️ valeurs nl/en vides : ${emptyVals} | entrées flaggées (note) : ${flagged}`);

  // 2. Expansion records → lignes ContentTranslation (nl + en).
  const rows: {
    model: string;
    recordId: string;
    field: string;
    locale: string;
    value: string;
    status: string;
  }[] = [];
  let missing = 0;
  for (const file of readdirSync(RECORDS).filter((f) => f.endsWith(".json"))) {
    const model = modelOf(file);
    const recs = JSON.parse(readFileSync(path.join(RECORDS, file), "utf8")) as Rec[];
    const trans = byModel.get(model);
    if (!trans) {
      console.log(`⚠️ aucune trad pour le modèle ${model} — sauté`);
      continue;
    }
    for (const r of recs) {
      const t = trans.get(r.value);
      if (!t) {
        missing++;
        continue;
      }
      for (const loc of LOCALES) {
        const value = (loc === "nl" ? t.nl : t.en)?.trim();
        if (!value) continue;
        rows.push({ model, recordId: r.id, field: r.field, locale: loc, value, status: "ia" });
      }
    }
  }
  console.log(`Lignes à insérer : ${rows.length} | sources FR sans trad : ${missing}`);

  // 3. createMany batché, idempotent.
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const res = await prisma.contentTranslation.createMany({
      data: rows.slice(i, i + BATCH),
      skipDuplicates: true,
    });
    inserted += res.count;
    console.log(`… batch ${i / BATCH + 1} : +${res.count} (${i + Math.min(BATCH, rows.length - i)}/${rows.length})`);
  }
  console.log(`✅ ${inserted} nouvelles lignes insérées (doublons ignorés)`);

  // 4. Bilan par locale + par modèle.
  for (const loc of LOCALES) {
    const c = await prisma.contentTranslation.count({ where: { locale: loc } });
    console.log(`  ${loc} : ${c} lignes au total`);
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
