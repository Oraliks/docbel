// Applique les améliorations du schéma C1 sur le PdfForm correspondant en DB.
//
// Cherche le PdfForm dont sourceFileName matche C1_FR.pdf (regex souple pour
// couvrir les variantes "C1_FR.pdf", "c1_fr.pdf", "C1_FR (1).pdf" etc.) et
// remplace son champ `fields` JSON par la version enrichie produite par
// applyC1Improvements().
//
// Idempotent : à relancer après chaque ré-import du C1 via /admin/pdf-sources.
//
// Usage : pnpm tsx scripts/apply-c1-improvements.ts        (dry run par défaut)
//         pnpm tsx scripts/apply-c1-improvements.ts --yes  (applique en DB)

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyC1Improvements, C1_TRIGGERS } from "@/lib/pdf-forms/seed/c1-fields-improvements";
import type { PdfFormField } from "@/lib/pdf-forms/types";

const APPLY = process.argv.includes("--yes");

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}\n`);

  // Match souple sur le nom de fichier — le PdfForm peut avoir été importé
  // avec des suffixes (renommage Windows, "C1_FR (1).pdf"…). On cible le
  // dernier importé (updatedAt desc) en cas de plusieurs candidats.
  const candidates = await prisma.pdfForm.findMany({
    where: {
      sourceFileName: { contains: "C1_FR", mode: "insensitive" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, title: true, sourceFileName: true, version: true, fields: true, triggers: true },
  });

  if (candidates.length === 0) {
    console.error("Aucun PdfForm trouvé pour C1_FR.pdf. Importe-le d'abord via /admin/pdf-sources.");
    process.exit(1);
  }

  console.log(`Candidats (${candidates.length}) :`);
  for (const c of candidates) {
    console.log(`  - ${c.slug.padEnd(30)} v${c.version}  ${c.sourceFileName}`);
  }

  const target = candidates[0];
  console.log(`\nCible : ${target.slug} (le plus récent)\n`);

  const current = (target.fields as unknown as PdfFormField[]) || [];
  const improved = applyC1Improvements(current);

  const beforeCount = current.length;
  const afterCount = improved.length;
  const removed = beforeCount + (improved.length - beforeCount) - afterCount; // ignored
  void removed;

  console.log(`Champs avant     : ${beforeCount}`);
  console.log(`Champs après     : ${afterCount}`);
  console.log(`Delta            : ${afterCount - beforeCount} (négatif = nettoyage de doublons checkbox)`);
  console.log(`Triggers (avant) : ${Array.isArray(target.triggers) ? target.triggers.length : 0}`);
  console.log(`Triggers (après) : ${C1_TRIGGERS.length}`);

  // Stats sur les types des champs ajoutés
  const addedRadios = improved.filter(
    (f) => !current.some((c) => c.id === f.id) && f.type === "radio"
  ).length;
  console.log(`Radios ajoutés   : ${addedRadios}`);

  if (!APPLY) {
    console.log("\nDry-run terminé. Passe --yes pour appliquer.");
    return;
  }

  await prisma.pdfForm.update({
    where: { id: target.id },
    data: {
      fields: improved as unknown as Prisma.InputJsonValue,
      triggers: C1_TRIGGERS as unknown as Prisma.InputJsonValue,
    },
  });

  console.log(`\n✓ PdfForm ${target.slug} mis à jour (${afterCount} champs, ${C1_TRIGGERS.length} triggers).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
