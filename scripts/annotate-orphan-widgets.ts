/**
 * Cartographie visuelle des widgets AcroForm d'un formulaire ONEM.
 *
 * Produit une COPIE annotée du PDF source (l'original n'est jamais touché) :
 *   • encadré VERT PÂLE  = widget couvert (un champ ou une règle serveur l'écrit)
 *   • aplat ROUGE + n°   = widget ORPHELIN (rien ne l'écrit)
 * et liste les orphelins numérotés dans la console, avec page et position.
 *
 * Sert à répondre à « c'est quoi ces orphelins, et où sont-ils sur la feuille ? »
 * sans avoir à ouvrir un éditeur PDF. Compagnon de `dump-pdf-widgets.ts` (qui
 * donne la liste texte) et de l'onglet « Mapping AcroForm » de l'admin (qui
 * donne les compteurs).
 *
 * Usage :
 *   pnpm tsx scripts/annotate-orphan-widgets.ts               # tous les formulaires
 *   pnpm tsx scripts/annotate-orphan-widgets.ts c1            # un seul slug
 *   pnpm tsx scripts/annotate-orphan-widgets.ts c1 ./sortie   # + dossier de sortie
 *
 * ⚠ Analyse le SEED, pas le schéma réellement en base : la vraie liste de
 * `PdfForm.fields` peut contenir en plus des champs inférés à l'import. Pour
 * l'état exact en production, passer par l'onglet Mapping de l'admin.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { parsePdf } from "../lib/pdf-forms/acroform-parser";
import { buildMappingReport } from "../lib/pdf-forms/mapping-report";
import { getRulesForSlug } from "../lib/pdf-forms/bindings/registry";
import type { AcroFieldRaw, PdfFormField } from "../lib/pdf-forms/types";

import { applyC1Improvements } from "../lib/pdf-forms/seed/c1-fields-improvements";
import { applyC1RegisImprovements } from "../lib/pdf-forms/seed/c1-regis-fields";
import { applyC1PartenaireImprovements } from "../lib/pdf-forms/seed/c1-partenaire-fields";
import { applyC1AImprovements } from "../lib/pdf-forms/seed/c1a-fields";
import { applyC1BImprovements } from "../lib/pdf-forms/seed/c1b-fields";
import { applyC1CImprovements } from "../lib/pdf-forms/seed/c1c-fields";
import { applyC46Improvements } from "../lib/pdf-forms/seed/c46-fields";
import { applyC47Improvements } from "../lib/pdf-forms/seed/c47-fields";

type Improve = (
  fields: PdfFormField[],
  ctx?: { technicalSchema: AcroFieldRaw[] },
) => PdfFormField[];

const TARGETS: Array<{ key: string; slug: string; pdf: string; improve: Improve }> = [
  {
    key: "c1",
    slug: "c1-changement-situation",
    pdf: "C1_FR.pdf",
    improve: (fields, ctx) =>
      applyC1Improvements(fields, {
        defaultMotif: "modification",
        restrictMotifTo5Situations: true,
        technicalSchema: ctx?.technicalSchema,
      }),
  },
  { key: "c1-regis", slug: "c1-regis", pdf: "Annexe_Regis_FR.pdf", improve: applyC1RegisImprovements },
  { key: "c1-partenaire", slug: "c1-partenaire", pdf: "C1-Partenaire_FR.pdf", improve: applyC1PartenaireImprovements },
  { key: "c1a", slug: "c1a", pdf: "C1A_FR.pdf", improve: applyC1AImprovements },
  { key: "c1b", slug: "c1b", pdf: "C1B_FR.pdf", improve: applyC1BImprovements },
  { key: "c1c", slug: "c1c", pdf: "C1C_FR.pdf", improve: applyC1CImprovements },
  { key: "c46", slug: "c46", pdf: "C46_FR.pdf", improve: applyC46Improvements },
  { key: "c47", slug: "c47", pdf: "C47_FR.pdf", improve: applyC47Improvements },
];

async function annotate(
  target: (typeof TARGETS)[number],
  outDir: string,
): Promise<void> {
  const src = join(process.cwd(), "private", "pdfs", target.pdf);
  if (!existsSync(src)) {
    console.log(`\n${target.key} — ${target.pdf} introuvable, ignoré.`);
    return;
  }

  const bytes = readFileSync(src);
  const parsed = await parsePdf(bytes);
  const fields = target.improve([], { technicalSchema: parsed.fields });
  const report = buildMappingReport(fields, parsed.fields, getRulesForSlug(target.slug));

  const orphans = report.rows.filter((r) => r.status === "orphan");
  const bound = report.rows.filter((r) => r.status === "bound");

  console.log(
    `\n${target.key} (${target.pdf}) — ${report.summary.total} widgets · ` +
      `${report.summary.bound} couverts · ${report.summary.orphan} orphelins · ` +
      `${report.summary.conflict} conflits`,
  );
  if (orphans.length > 0) {
    for (const [i, r] of orphans.entries()) {
      const page = r.page === undefined ? "?" : r.page + 1;
      const pos = r.rect ? `x${Math.round(r.rect[0])} y${Math.round(r.rect[1])}` : "sans position";
      const name = r.pdfFieldName.replace(/\n/g, " ⏎ ");
      console.log(`  ${String(i + 1).padStart(2)}. p.${page} · ${pos} · ${r.acroType} · « ${name} »`);
    }
  }

  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  // Contexte : ce qui EST écrit, en liseré vert pâle.
  for (const row of bound) {
    if (row.page === undefined || !row.rect) continue;
    const page = pages[row.page];
    if (!page) continue;
    const [x, y, w, h] = row.rect;
    page.drawRectangle({
      x, y, width: w, height: h,
      borderColor: rgb(0.25, 0.65, 0.35),
      borderWidth: 0.9,
      borderOpacity: 0.85,
      opacity: 0,
    });
  }

  // Les orphelins : aplat rouge + pastille numérotée qui renvoie à la liste.
  orphans.forEach((row, i) => {
    if (row.page === undefined || !row.rect) return;
    const page = pages[row.page];
    if (!page) return;
    const [x, y, w, h] = row.rect;
    page.drawRectangle({
      x, y, width: w, height: h,
      color: rgb(1, 0.2, 0.2),
      opacity: 0.25,
      borderColor: rgb(0.8, 0, 0),
      borderWidth: 1.6,
    });
    const label = String(i + 1);
    const badgeW = 9 + label.length * 6;
    const bx = Math.max(1, x - 3);
    const by = Math.min(page.getHeight() - 15, y + h - 5);
    page.drawRectangle({ x: bx, y: by, width: badgeW, height: 14, color: rgb(0.8, 0, 0) });
    page.drawText(label, { x: bx + 4.5, y: by + 3.5, size: 9.5, font, color: rgb(1, 1, 1) });
  });

  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${target.key}-orphelins.pdf`);
  writeFileSync(out, await doc.save());
  console.log(`  → ${out}`);
}

async function main() {
  const [keyArg, outArg] = process.argv.slice(2);
  const outDir = outArg ?? join(tmpdir(), "beldoc-orphan-maps");
  const selected = keyArg ? TARGETS.filter((t) => t.key === keyArg) : TARGETS;

  if (selected.length === 0) {
    console.error(`Slug inconnu : ${keyArg}. Connus : ${TARGETS.map((t) => t.key).join(", ")}`);
    process.exit(1);
  }

  console.log("Légende : vert = widget couvert · rouge numéroté = orphelin (rien ne l'écrit)");
  for (const target of selected) await annotate(target, outDir);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
