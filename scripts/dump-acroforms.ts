// Dump des widgets AcroForm de tous les PDFs sous private/pdfs/.
// Utilise parsePdf() (lib/pdf-forms/acroform-parser.ts) — même code que
// l'admin. Affiche, par PDF : nom, type AcroForm, page, tooltip /TU,
// max-len, flags requis/multi-ligne/readonly, options pour dropdowns/radios.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "../lib/pdf-forms/acroform-parser";

async function main() {
  const dir = join(process.cwd(), "private", "pdfs");
  const files = readdirSync(dir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  console.log(`\nDump des AcroForms — ${files.length} PDFs sous private/pdfs/\n`);

  for (const f of files) {
    const buf = readFileSync(join(dir, f));
    const parsed = await parsePdf(buf);
    console.log(`\n══════════════════════════════════════════════════════════════════`);
    console.log(`▶ ${f}  (${parsed.pageCount} pages, ${parsed.fields.length} widgets)`);
    console.log(`══════════════════════════════════════════════════════════════════`);
    if (!parsed.hasAcroForm) {
      console.log("  (pas d'AcroForm — PDF plat)");
      continue;
    }
    for (const w of parsed.fields) {
      const flags: string[] = [];
      if (w.required) flags.push("REQUIS");
      if (w.readOnly) flags.push("READONLY");
      if (w.multiline) flags.push("MULTILINE");
      const opt = w.options?.length ? ` opt=[${w.options.join("|")}]` : "";
      const tip = w.tooltip ? ` /TU="${w.tooltip}"` : "";
      const maxlen = w.maxLen ? ` max=${w.maxLen}` : "";
      const def = w.defaultValue ? ` def="${w.defaultValue}"` : "";
      const page = w.page !== undefined ? ` p${w.page + 1}` : "";
      const flagsStr = flags.length ? ` [${flags.join(",")}]` : "";
      console.log(`  • ${w.pdfFieldName.padEnd(36)} ${w.acroType.padEnd(8)}${page}${flagsStr}${tip}${maxlen}${def}${opt}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
