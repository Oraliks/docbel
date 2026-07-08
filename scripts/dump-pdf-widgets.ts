// Généralisation de `dump-c1.ts` — dumpe l'AcroForm d'un PDF quelconque de
// `private/pdfs/`. Utile pour écrire de nouvelles règles de bindings serveur
// (`lib/pdf-forms/bindings/per-form/`) sans devoir dupliquer le script.
//
// Usage :
//   pnpm tsx scripts/dump-pdf-widgets.ts C1A_FR
//   pnpm tsx scripts/dump-pdf-widgets.ts --all       # dumpe tous les .pdf de private/pdfs/

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";

async function dumpOne(fileName: string, outDir: string): Promise<void> {
  const pdfPath = join(process.cwd(), "private", "pdfs", fileName);
  const buf = readFileSync(pdfPath);
  const parsed = await parsePdf(buf);
  const base = fileName.replace(/\.pdf$/i, "");
  const out: string[] = [];
  out.push(`${fileName} — ${parsed.pageCount} pages, ${parsed.fields.length} widgets`);
  out.push("");
  const sorted = parsed.fields.slice().sort((a, b) => {
    const pa = a.page ?? 0, pb = b.page ?? 0;
    if (pa !== pb) return pa - pb;
    const ya = a.rect?.[1] ?? 0, yb = b.rect?.[1] ?? 0;
    if (yb !== ya) return yb - ya;
    return (a.rect?.[0] ?? 0) - (b.rect?.[0] ?? 0);
  });
  for (const w of sorted) {
    const p = (w.page ?? 0) + 1;
    const r = w.rect ? `(x=${Math.round(w.rect[0])},y=${Math.round(w.rect[1])})` : "";
    const mx = typeof w.maxLen === "number" ? ` max=${w.maxLen}` : "";
    const tip = w.tooltip ? ` TU="${w.tooltip}"` : "";
    const opts = w.options?.length
      ? ` opt=[${w.options.slice(0, 4).join("|")}${w.options.length > 4 ? "…" : ""}]`
      : "";
    out.push(`p${p} ${w.acroType.padEnd(9)} ${w.pdfFieldName.padEnd(48)} ${r}${mx}${tip}${opts}`);
  }
  const outPath = join(outDir, `${base}-widgets.txt`);
  writeFileSync(outPath, out.join("\n"));
  console.log(`✓ ${fileName} → ${outPath} (${parsed.fields.length} widgets)`);
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: pnpm tsx scripts/dump-pdf-widgets.ts <FILE|--all>");
    console.error("  ex.: pnpm tsx scripts/dump-pdf-widgets.ts C1A_FR");
    console.error("  ex.: pnpm tsx scripts/dump-pdf-widgets.ts --all");
    process.exit(1);
  }
  const outDir = join(tmpdir(), "beldoc-pdf-widgets");
  mkdirSync(outDir, { recursive: true });

  if (arg === "--all") {
    const dir = join(process.cwd(), "private", "pdfs");
    const files = readdirSync(dir).filter((f) => /\.pdf$/i.test(f));
    for (const f of files) {
      try {
        await dumpOne(f, outDir);
      } catch (err) {
        console.error(`✗ ${f}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    console.log(`\nOutput dir: ${outDir}`);
    return;
  }

  // Nom passé sans extension → on rajoute .pdf ; sinon on prend tel quel.
  const fileName = /\.pdf$/i.test(arg) ? arg : `${arg}.pdf`;
  await dumpOne(fileName, outDir);
  console.log(`\nOutput dir: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
