/// Seed du Decision Builder : prépare l'arbre DB `chomage-orientation` depuis
/// la nomenclature ONEM 2026. À la création, l'arbre est publié. Sur un arbre
/// existant, le seed fusionne seulement les nœuds manquants dans le BROUILLON :
/// il ne remplace jamais les éditions admin et ne republie jamais implicitement.
///
/// NB : le flag `DECISION_TREE_RUNTIME_ENABLED` reste OFF par défaut → tant
/// qu'on ne l'active pas, /mon-dossier utilise toujours le TS. Le seed prépare
/// juste l'arbre pour pouvoir basculer en douceur.

import { PrismaClient, Prisma } from "@prisma/client";
import { wizardSituationsToTreeContent } from "../../lib/decision-builder/from-wizard";
import { applyOnem2026CanonicalTags } from "../../lib/decision-builder/onem-canonical";
import { mergeSeedTreeContent } from "../../lib/decision-builder/merge-seed";
import { parseTreeContent } from "../../lib/decision-builder/schema";
import {
  mapOnem2026ToWizardSituations,
  ONEM_2026_STUB_BUNDLES,
} from "./data/onem-2026-tree";

const SLUG = "chomage-orientation";

/// Crée les dossiers "à créer" en stubs INACTIFS (active=false) : invisibles du
/// public, éditables dans l'admin pour être complétés plus tard. Idempotent.
async function seedStubBundles(prisma: PrismaClient): Promise<void> {
  for (const stub of ONEM_2026_STUB_BUNDLES) {
    const exists = await prisma.documentBundle.findUnique({
      where: { slug: stub.slug },
      select: { id: true },
    });
    if (exists) continue; // ne JAMAIS écraser un dossier existant
    await prisma.documentBundle.create({
      data: {
        slug: stub.slug,
        name: stub.name,
        description: "Dossier en préparation — orientation disponible, formulaires à venir.",
        organism: "ONEM",
        lifeEventCategory: "emploi",
        active: false, // masqué du public tant qu'il n'est pas prêt
        createdBy: "seed",
      },
    });
  }
  console.log(`   ✓ ${ONEM_2026_STUB_BUNDLES.length} dossiers stub vérifiés/créés (inactifs)`);
}

export async function seedDecisionTrees(prisma: PrismaClient): Promise<void> {
  await seedStubBundles(prisma);

  const content = applyOnem2026CanonicalTags(
    wizardSituationsToTreeContent(mapOnem2026ToWizardSituations()),
  );
  const contentJson = content as unknown as Prisma.InputJsonValue;
  const now = new Date();

  const existing = await prisma.decisionTree.findUnique({
    where: { slug: SLUG },
    select: { id: true, draftContent: true },
  });

  if (!existing) {
    const tree = await prisma.decisionTree.create({
      data: {
        slug: SLUG,
        title: "Orientation chômage",
        description:
          "Arbre d'orientation /mon-dossier basé sur la nomenclature ONEM 2026 et les dossiers DocBel actifs.",
        segment: "chomage",
        status: "published",
        draftContent: contentJson,
        publishedContent: contentJson,
        publishedAt: now,
        createdBy: "seed",
        updatedBy: "seed",
      },
    });
    const rev = await prisma.decisionTreeRevision.create({
      data: {
        treeId: tree.id,
        version: 1,
        content: contentJson,
        changeType: "major",
        changeNotes: "Import initial depuis WIZARD_SITUATIONS (seed).",
        publishedBy: "seed",
      },
    });
    await prisma.decisionTree.update({
      where: { id: tree.id },
      data: { publishedRevisionId: rev.id },
    });
    console.log(`   ✓ arbre ${SLUG} créé + publié (v1)`);
    return;
  }

  const currentDraft = parseTreeContent(existing.draftContent);
  const merged = mergeSeedTreeContent(currentDraft, content);
  if (
    merged.addedNodeIds.length === 0 &&
    merged.addedRootOptionIds.length === 0
  ) {
    console.log(`   = arbre ${SLUG} déjà à jour`);
    return;
  }

  // Ne touche qu'au brouillon. L'admin valide puis publie explicitement : le
  // seed ne doit jamais faire fuiter un contenu non relu vers /mon-dossier.
  await prisma.decisionTree.update({
    where: { id: existing.id },
    data: {
      draftContent: merged.content as unknown as Prisma.InputJsonValue,
      updatedBy: "seed",
    },
  });
  console.log(
    `   ↑ arbre ${SLUG} enrichi dans le brouillon ` +
      `(+${merged.addedNodeIds.length} nœuds, +${merged.addedRootOptionIds.length} porte racine)`,
  );
  if (merged.preservedConflictIds.length > 0) {
    console.log(
      `   ↳ ${merged.preservedConflictIds.length} nœud(s) admin préservé(s) malgré un écart avec le seed`,
    );
  }
}
