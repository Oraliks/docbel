/// Seed du Decision Builder : importe les 7 situations chômage historiques
/// (lib/dossier-wizard/config.ts → WIZARD_SITUATIONS) en un arbre DB publié
/// `chomage-orientation`. Idempotent (upsert par slug ; révision ajoutée
/// uniquement si le contenu change). Garanti iso-fonctionnel par le test de
/// parité `lib/decision-builder/__tests__/seed-parity.test.ts`.
///
/// NB : le flag `DECISION_TREE_RUNTIME_ENABLED` reste OFF par défaut → tant
/// qu'on ne l'active pas, /mon-dossier utilise toujours le TS. Le seed prépare
/// juste l'arbre pour pouvoir basculer en douceur.

import { PrismaClient, Prisma } from "@prisma/client";
import { wizardSituationsToTreeContent } from "../../lib/decision-builder/from-wizard";
import { applyOnem2026CanonicalTags } from "../../lib/decision-builder/onem-canonical";
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
    select: { id: true, publishedContent: true },
  });

  if (!existing) {
    const tree = await prisma.decisionTree.create({
      data: {
        slug: SLUG,
        title: "Orientation chômage",
        description:
          "Arbre d'orientation /mon-dossier importé depuis la config historique (7 situations ONEM).",
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

  // Idempotence : si le contenu publié est identique, rien à faire.
  const sameContent =
    JSON.stringify(existing.publishedContent) === JSON.stringify(content);
  if (sameContent) {
    console.log(`   = arbre ${SLUG} déjà à jour`);
    return;
  }

  // Contenu changé (config TS modifiée) → met à jour + nouvelle révision.
  const last = await prisma.decisionTreeRevision.findFirst({
    where: { treeId: existing.id },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const nextVersion = (last?.version ?? 0) + 1;
  const rev = await prisma.decisionTreeRevision.create({
    data: {
      treeId: existing.id,
      version: nextVersion,
      content: contentJson,
      changeType: "minor",
      changeNotes: "Resynchronisation depuis WIZARD_SITUATIONS (seed).",
      publishedBy: "seed",
    },
  });
  await prisma.decisionTree.update({
    where: { id: existing.id },
    data: {
      draftContent: contentJson,
      publishedContent: contentJson,
      publishedAt: now,
      publishedRevisionId: rev.id,
      status: "published",
      updatedBy: "seed",
    },
  });
  console.log(`   ↑ arbre ${SLUG} resynchronisé (v${nextVersion})`);
}
