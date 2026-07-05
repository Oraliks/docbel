// Recalcule les `fields` du PdfForm c109-36-demande déjà seedé, après l'ajout
// de sections/labels explicites sur les 39 champs auto-inférés du PDF
// officiel (2026-07) — sans quoi ils restaient tous fourrés dans un onglet
// "Informations" fourre-tout, et l'ancien bug de regroupement par section
// consécutive faisait apparaître "Identité" deux fois dans le stepper.
//
// Idempotent : à relancer après chaque évolution des déclarations de champs.
//
// Usage : pnpm tsx scripts/recompute-c109-demande-fields.ts        (dry run)
//         pnpm tsx scripts/recompute-c109-demande-fields.ts --yes  (applique)

import { prisma } from "@/lib/prisma";
import { recomputeDocumentFields } from "@/lib/dossiers/seed";
import { allocationsInsertion } from "@/lib/dossiers/allocations-insertion";

const APPLY = process.argv.includes("--yes");

async function main() {
  const doc = allocationsInsertion.documents.find((d) => d.slug === "c109-36-demande");
  if (!doc) throw new Error("c109-36-demande introuvable dans allocations-insertion");

  console.log(`Mode : ${APPLY ? "🔥 APPLY" : "👀 DRY RUN"}`);
  const r = await recomputeDocumentFields(doc, APPLY);
  if (r.status === "not_found") {
    console.log("⚠️  c109-36-demande introuvable en DB — seed-le d'abord.");
    return;
  }
  console.log(`\n${r.slug}`);
  console.log(`  Champs avant : ${r.fieldsBefore}`);
  console.log(`  Champs après : ${r.fieldsAfter}`);
  if (APPLY) console.log("  ✓ mis à jour");
  else console.log("\nDry-run terminé. Passe --yes pour appliquer.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
