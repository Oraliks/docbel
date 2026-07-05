// Applique les améliorations de schéma sur les PdfForms de la famille C1 en
// DB : le C1 générique, le C1 du dossier insertion (c1-insertion), l'Annexe
// Regis (c1-regis) et les formulaires compagnons déclenchés par le C1
// (c1-partenaire, c1a, c1b, c1c, c46, c47) — cf. C1_IMPROVEMENT_TARGETS.
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

import { prisma } from "@/lib/prisma";
import { C1_IMPROVEMENT_TARGETS, applyOneC1Improvement } from "@/lib/pdf-forms/seed/apply-c1-improvements-core";

const APPLY = process.argv.includes("--yes");

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}`);
  for (const target of C1_IMPROVEMENT_TARGETS) {
    const r = await applyOneC1Improvement(target, APPLY);
    if (r.status === "not_found") {
      console.log(`⚠️  ${r.slug.padEnd(16)} introuvable en DB — seed-le d'abord (endpoint admin ou seed-c1-companion-forms.ts).`);
      continue;
    }
    console.log(`\n${r.slug} (v${r.version}, id=${r.formId})`);
    console.log(`  Champs avant     : ${r.fieldsBefore}`);
    console.log(`  Champs après     : ${r.fieldsAfter}`);
    console.log(`  Triggers avant   : ${r.triggersBefore}`);
    console.log(`  Triggers après   : ${r.triggersAfter}`);
    if (APPLY) console.log(`  ✓ mis à jour`);
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
