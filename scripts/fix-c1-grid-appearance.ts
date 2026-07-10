// Corrige l'apparence de la grille cohabitants du C1 (Oraliks 2026-07-10) :
//   - les cases `Personne{N}_AllocationsFamiliales` et les dropdowns
//     `_ActiviteProfessionnelle_Type` / `_RevenuRemplacement_Type` ont un FOND
//     BLANC OPAQUE (MK.BG=[1]) qui masque la grille imprimée → les cellules
//     vides (rangées non remplies) peignent des rectangles blancs = colonne
//     « effacée » ; une case décochée = carré blanc invisible (« ni case ni
//     rien »).
//   - Fix : on retire MK.BG (transparent), et on AJOUTE une bordure noire aux
//     cases à cocher (carré visible coché/vide). On régénère les apparences.
//
// Idempotent + réutilisable : à relancer après chaque nouveau C1_FR.pdf
// d'Oraliks (sa version efface ce fix). Écrit sur les 2 chemins servis.
//
// Usage : pnpm tsx scripts/fix-c1-grid-appearance.ts [--yes]
import { readFileSync, writeFileSync } from "fs";
import { PDFDocument, PDFName, PDFDict, PDFArray, PDFNumber, StandardFonts } from "pdf-lib";

const APPLY = process.argv.includes("--yes");
const PATHS = [
  "C:\\Users\\Admin\\Desktop\\beldoc\\private\\pdfs\\C1_FR.pdf",
  "C:\\Users\\Admin\\Desktop\\beldoc\\private\\uploads\\pdfform-1783266184026-C1_FR.pdf",
];
const RE = /^Personne[1-5]_(AllocationsFamiliales|ActiviteProfessionnelle_Type|RevenuRemplacement_Type)$/;

function mkOf(dict: PDFDict, doc: PDFDocument): PDFDict {
  let mk = dict.lookupMaybe(PDFName.of("MK"), PDFDict);
  if (!mk) { mk = doc.context.obj({}); dict.set(PDFName.of("MK"), mk); }
  return mk;
}

async function fixOne(path: string) {
  const doc = await PDFDocument.load(readFileSync(path));
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const form = doc.getForm();
  let checkboxes = 0, dropdowns = 0;

  for (const f of form.getFields()) {
    if (!RE.test(f.getName())) continue;
    const type = f.constructor.name;
    for (const w of f.acroField.getWidgets()) {
      const mk = mkOf(w.dict, doc);
      mk.delete(PDFName.of("BG")); // retire le fond blanc opaque
      if (type === "PDFCheckBox") {
        // Bordure noire fine → carré visible même décoché.
        mk.set(PDFName.of("BC"), doc.context.obj([0, 0, 0].map((n) => PDFNumber.of(n)) as unknown as PDFArray["array"]));
        const bs = doc.context.obj({ W: PDFNumber.of(1), S: PDFName.of("S") });
        w.dict.set(PDFName.of("BS"), bs);
      }
    }
    try {
      if (type === "PDFCheckBox") { form.getCheckBox(f.getName()).defaultUpdateAppearances(); checkboxes++; }
      else if (type === "PDFDropdown") { form.getDropdown(f.getName()).defaultUpdateAppearances(helv); dropdowns++; }
    } catch (e) { console.log(`  ⚠️ regen ${f.getName()} : ${(e as Error).message}`); }
  }
  console.log(`${path.split("\\").pop()} : ${checkboxes} cases + ${dropdowns} dropdowns corrigés`);
  if (APPLY) writeFileSync(path, await doc.save());
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY"}`);
  for (const p of PATHS) await fixOne(p);
  if (!APPLY) console.log("\nDry-run. --yes pour écrire.");
}
main().catch((e) => { console.error(e); process.exit(1); });
