// Applique les améliorations de schéma sur les PdfForms de la famille C1 en
// DB : le C1 de changement de situation, l'Annexe Regis (c1-regis) et les
// formulaires compagnons déclenchés par le C1
// (c1-partenaire, c1a, c1b, c1c, c46, c47) — cf. C1_IMPROVEMENT_TARGETS.
// Chaque cible est explicitement nommée : le script ne sélectionne jamais un
// formulaire selon son nom de fichier source.
//
// Idempotent : à relancer après chaque ré-import.
//
// Usage : pnpm tsx scripts/apply-c1-improvements.ts        (dry run par défaut)
//         pnpm tsx scripts/apply-c1-improvements.ts --yes  (applique en DB)
//         pnpm tsx scripts/apply-c1-improvements.ts --yes --slug c1-changement-situation
//           (applique une seule cible)

import { prisma } from "@/lib/prisma";
import { C1_IMPROVEMENT_TARGETS, applyOneC1Improvement } from "@/lib/pdf-forms/seed/apply-c1-improvements-core";

const APPLY = process.argv.includes("--yes");
const slugArgIndex = process.argv.indexOf("--slug");
const targetSlug = slugArgIndex >= 0 ? process.argv[slugArgIndex + 1] : undefined;

async function main() {
  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}`);
  const targets = targetSlug
    ? C1_IMPROVEMENT_TARGETS.filter((target) => target.slug === targetSlug)
    : C1_IMPROVEMENT_TARGETS;
  if (targetSlug && targets.length === 0) {
    throw new Error(`Cible C1 inconnue : ${targetSlug}`);
  }
  for (const target of targets) {
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
