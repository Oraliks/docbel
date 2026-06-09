import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";

async function main() {
  const buf = readFileSync(join(process.cwd(), "private", "pdfs", "C1_FR.pdf"));
  const parsed = await parsePdf(buf);
  const out: string[] = [];
  out.push(`C1_FR.pdf — ${parsed.pageCount} pages, ${parsed.fields.length} widgets`);
  out.push("");
  const sorted = parsed.fields.slice().sort((a, b) => {
    const pa = a.page ?? 0, pb = b.page ?? 0;
    if (pa !== pb) return pa - pb;
    const ya = (a.rect?.[1] ?? 0), yb = (b.rect?.[1] ?? 0);
    if (yb !== ya) return yb - ya;
    return (a.rect?.[0] ?? 0) - (b.rect?.[0] ?? 0);
  });
  for (const w of sorted) {
    const p = (w.page ?? 0) + 1;
    const r = w.rect ? `(x=${Math.round(w.rect[0])},y=${Math.round(w.rect[1])})` : "";
    const tip = w.tooltip ? ` TU="${w.tooltip}"` : "";
    const opts = w.options?.length ? ` opt=[${w.options.slice(0, 4).join("|")}${w.options.length > 4 ? "…" : ""}]` : "";
    out.push(`p${p} ${w.acroType.padEnd(9)} ${w.pdfFieldName.padEnd(32)} ${r}${tip}${opts}`);
  }
  writeFileSync("/tmp/c1-widgets.txt", out.join("\n"));
  console.log(`Dumped ${parsed.fields.length} widgets to /tmp/c1-widgets.txt`);
}

main().catch(console.error);
