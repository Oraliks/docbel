// Applique les améliorations de schéma sur les PdfForms de la famille C1 en
// DB : le C1 générique, le C1 du dossier insertion (c1-insertion) et
// l'Annexe Regis (c1-regis).
//
// AVANT (bug) : ce script ciblait "le PdfForm le plus récemment modifié dont
// sourceFileName contient C1_FR" — comme c1-insertion partage le même
// fichier source (C1_FR.pdf) que le C1 générique, il risquait de mettre à
// jour le mauvais PdfForm selon l'ordre des dernières modifications.
// MAINTENANT : cible une liste de slugs explicite, un par un.
//
// Idempotent : à relancer après chaque ré-import.
//
// Usage : pnpm tsx scripts/apply-c1-improvements.ts        (dry run par défaut)
//         pnpm tsx scripts/apply-c1-improvements.ts --yes  (applique en DB)

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { applyC1Improvements, C1_TRIGGERS } from "@/lib/pdf-forms/seed/c1-fields-improvements";
import { applyC1RegisImprovements } from "@/lib/pdf-forms/seed/c1-regis-fields";
import type { PdfFormField, PdfFormTrigger } from "@/lib/pdf-forms/types";

const APPLY = process.argv.includes("--yes");

interface TargetConfig {
  slug: string;
  improve: (fields: PdfFormField[]) => PdfFormField[];
  triggers: PdfFormTrigger[];
}

const TARGETS: TargetConfig[] = [
  { slug: "c1", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  { slug: "c1-insertion", improve: applyC1Improvements, triggers: C1_TRIGGERS },
  { slug: "c1-regis", improve: applyC1RegisImprovements, triggers: [] },
];

async function applyOne(target: TargetConfig) {
  const form = await prisma.pdfForm.findUnique({
    where: { slug: target.slug },
    select: { id: true, slug: true, title: true, version: true, fields: true, triggers: true },
  });
  if (!form) {
    console.log(`⚠️  ${target.slug.padEnd(16)} introuvable en DB — seed-le d'abord (endpoint admin ou seed-c1-companion-forms.ts).`);
    return;
  }

  const current = (form.fields as unknown as PdfFormField[]) || [];
  const improved = target.improve(current);

  console.log(`\n${target.slug} (v${form.version}, id=${form.id})`);
  console.log(`  Champs avant     : ${current.length}`);
  console.log(`  Champs après     : ${improved.length}`);
  console.log(`  Triggers avant   : ${Array.isArray(form.triggers) ? form.triggers.length : 0}`);
  console.log(`  Triggers après   : ${target.triggers.length}`);

  if (!APPLY) return;

  await prisma.pdfForm.update({
    where: { id: form.id },
    data: {
      fields: improved as unknown as Prisma.InputJsonValue,
      triggers: target.triggers as unknown as Prisma.InputJsonValue,
    },
  });
  console.log(`  ✓ mis à jour`);
}

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}`);
  for (const target of TARGETS) {
    await applyOne(target);
  }
  if (!APPLY) {
    console.log("\nDry-run terminé. Passe --yes pour appliquer.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
