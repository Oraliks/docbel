// Scaffold un seed enrichi initial pour un nouveau document ONEM.
//
// Usage :
//   pnpm tsx scripts/scaffold-pdf-form.ts <PDF> <SLUG>
//   ex.: pnpm tsx scripts/scaffold-pdf-form.ts C1B_FR c1b
//
// Sortie : `lib/pdf-forms/seed/<slug>-fields.ts` avec les champs déjà
// pré-remplis (id, type, label FR, canonicalKey inféré via heuristiques,
// section). L'admin n'a plus qu'à ajuster labels NL/DE + valider les
// tags canoniques + ajouter les règles serveur si patterns composites.
//
// Ne touche pas la DB — le script produit uniquement un fichier .ts.
// Après édition manuelle, ajouter la cible dans
// `lib/pdf-forms/seed/apply-c1-improvements-core.ts#C1_IMPROVEMENT_TARGETS`
// et importer/publier via l'admin.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { buildEnrichedSchema } from "@/lib/pdf-forms/field-inference";

/// Emet un fichier .ts formaté avec les champs enrichis. Aucun JSON.stringify
/// brutal — on écrit un vrai TS lisible pour que l'admin/dev puisse
/// éditer/commit sans reformatage.
function emitSeedTs(fields: import("@/lib/pdf-forms/types").PdfFormField[], slug: string): string {
  const constantSlug = slug.toUpperCase().replace(/-/g, "_");
  const header = `// Seed enrichi initial pour \`${slug}\`.
//
// Généré par \`pnpm tsx scripts/scaffold-pdf-form.ts\`. L'ordre des champs
// suit l'ordre AcroForm (page puis Y décroissant). Les canonicalKey sont
// inférés depuis les heuristiques \`field-inference.ts\` — VÉRIFIER un
// par un : la première passe est un ~80% brut, PAS une vérité admin.
//
// Après édition manuelle :
//   1. Ajouter la cible dans \`seed/apply-c1-improvements-core.ts\`
//      (\`C1_IMPROVEMENT_TARGETS\`).
//   2. \`pnpm tsx scripts/apply-c1-improvements.ts --yes\`.
//   3. Publier via /admin/pdf/[id].

import type { PdfFormField } from "../types";

export const ${constantSlug}_FIELDS: PdfFormField[] = [
`;

  const body = fields
    .map((f, i) => {
      const lines: string[] = [];
      lines.push("  {");
      lines.push(`    id: ${JSON.stringify(f.id)},`);
      lines.push(`    pdfFieldName: ${JSON.stringify(f.pdfFieldName)},`);
      lines.push(`    type: ${JSON.stringify(f.type)},`);
      lines.push(`    required: ${f.required},`);
      lines.push(`    label: { fr: ${JSON.stringify(f.label.fr ?? f.id)} },`);
      if (f.canonicalKey) lines.push(`    canonicalKey: ${JSON.stringify(f.canonicalKey)},`);
      if (f.section) lines.push(`    section: ${JSON.stringify(f.section)},`);
      if (f.maxLength) lines.push(`    maxLength: ${f.maxLength},`);
      if (f.prefillFrom) lines.push(`    prefillFrom: ${JSON.stringify(f.prefillFrom)},`);
      if (f.options && f.options.length > 0) {
        lines.push(`    options: [`);
        for (const o of f.options) {
          lines.push(`      { value: ${JSON.stringify(o.value)}, label: { fr: ${JSON.stringify(o.label.fr ?? o.value)} } },`);
        }
        lines.push(`    ],`);
      }
      lines.push(`    order: ${i},`);
      lines.push("  },");
      return lines.join("\n");
    })
    .join("\n");

  return `${header}${body}\n];\n`;
}

/// Récapitulatif court en console — canonicalKey inférés + orphelins
/// (widgets non tagués = probablement à examiner à la main).
function printSummary(fields: import("@/lib/pdf-forms/types").PdfFormField[]): void {
  const tagged = fields.filter((f) => f.canonicalKey);
  const untagged = fields.filter((f) => !f.canonicalKey && f.type !== "checkbox" && f.type !== "select" && f.type !== "radio");
  console.log(`\nCanonicalKey inférés : ${tagged.length}/${fields.length}`);
  for (const f of tagged.slice(0, 20)) {
    console.log(`  ✓ ${f.id} → ${f.canonicalKey}`);
  }
  if (untagged.length > 0) {
    console.log(`\nWidgets texte NON tagués (à examiner) : ${untagged.length}`);
    for (const f of untagged.slice(0, 10)) {
      console.log(`  ? ${f.id} (${f.pdfFieldName})`);
    }
    if (untagged.length > 10) console.log(`  … + ${untagged.length - 10} autres`);
  }
}

async function main() {
  const [, , pdfArg, slugArg] = process.argv;
  if (!pdfArg || !slugArg) {
    console.error("Usage: pnpm tsx scripts/scaffold-pdf-form.ts <PDF> <SLUG>");
    console.error("  ex.: pnpm tsx scripts/scaffold-pdf-form.ts C1B_FR c1b");
    process.exit(1);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(slugArg)) {
    console.error(`Slug invalide « ${slugArg} » — utiliser [a-z][a-z0-9-]*`);
    process.exit(1);
  }
  const fileName = /\.pdf$/i.test(pdfArg) ? pdfArg : `${pdfArg}.pdf`;
  const pdfPath = join(process.cwd(), "private", "pdfs", fileName);
  if (!existsSync(pdfPath)) {
    console.error(`PDF introuvable : ${pdfPath}`);
    console.error("  Déposer le fichier dans private/pdfs/ (cf. docs/pdf-forms-add-document.md § 1).");
    process.exit(1);
  }
  const outPath = join(process.cwd(), "lib", "pdf-forms", "seed", `${slugArg}-fields.ts`);
  if (existsSync(outPath)) {
    console.error(`Fichier déjà existant : ${outPath}`);
    console.error("  Supprime-le d'abord si tu veux re-scaffolder (le contenu manuel sera perdu).");
    process.exit(1);
  }

  const buf = readFileSync(pdfPath);
  const parsed = await parsePdf(buf);
  console.log(`Parsed ${fileName} : ${parsed.pageCount} pages, ${parsed.fields.length} widgets`);

  const fields = buildEnrichedSchema(parsed.fields);
  const ts = emitSeedTs(fields, slugArg);
  writeFileSync(outPath, ts);
  console.log(`✓ Seed écrit : ${outPath}`);

  printSummary(fields);
  console.log(`\nProchaines étapes (cf. docs/pdf-forms-add-document.md) :`);
  console.log(`  1. Édite ${outPath} pour corriger labels + canonicalKey + section.`);
  console.log(`  2. Ajoute la cible dans seed/apply-c1-improvements-core.ts.`);
  console.log(`  3. pnpm tsx scripts/apply-c1-improvements.ts --yes`);
  console.log(`  4. Publier via /admin/pdf/<id>.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
