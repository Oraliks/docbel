/// Smoke test d'intégration du Decision Builder (Phase 3) — exerce le cœur
/// métier extrait dans lib/decision-builder/server.ts directement en base,
/// sans passer par HTTP/auth. Idempotent : nettoie l'arbre de test à la fin.
///
/// Lancer : pnpm exec dotenv -e .env.local -- tsx scripts/smoke-decision-tree.ts

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emptyTreeContent } from "@/lib/decision-builder/schema";
import {
  publishTree,
  restoreRevisionToDraft,
  validateTreeContentAgainstDb,
} from "@/lib/decision-builder/server";
import type { DecisionTreeContent } from "@/lib/decision-builder/types";

const SLUG = "__smoke-decision-tree";
const ACTOR = "smoke-test";

let failures = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures++;
  }
}

function buildContent(bundleSlug: string, label: string): DecisionTreeContent {
  return {
    version: 1,
    rootNodeId: "q_root",
    nodes: {
      q_root: {
        type: "question",
        id: "q_root",
        text: "Quelle est votre situation ?",
        optionIds: ["opt_a"],
      },
      opt_a: { type: "option", id: "opt_a", label, nextId: "r_result" },
      r_result: {
        type: "result",
        id: "r_result",
        bundleSlug,
        title: "Dossier de test",
        rationale: "Smoke test.",
        matchLevel: "recommande",
      },
    },
  };
}

async function cleanup() {
  await prisma.decisionTree.deleteMany({ where: { slug: SLUG } });
}

async function main() {
  console.log("→ Smoke test Decision Builder\n");

  // Bundle actif réel pour avoir un résultat publiable.
  const bundle = await prisma.documentBundle.findFirst({
    where: { active: true },
    select: { slug: true },
  });
  if (!bundle) {
    console.error("Aucun DocumentBundle actif — impossible de tester. Abort.");
    process.exit(1);
  }
  console.log(`  (bundle de test : ${bundle.slug})`);

  await cleanup(); // au cas où un run précédent aurait laissé des traces

  // 1. Création (draft vide).
  const tree = await prisma.decisionTree.create({
    data: {
      slug: SLUG,
      title: "Smoke Decision Tree",
      segment: "chomage",
      status: "draft",
      draftContent: emptyTreeContent() as unknown as Prisma.InputJsonValue,
      createdBy: ACTOR,
      updatedBy: ACTOR,
    },
  });
  check("arbre créé en draft", tree.status === "draft");

  // 2. Un draft vide n'est PAS publiable (no_root).
  const emptyReport = await validateTreeContentAgainstDb(emptyTreeContent());
  check("draft vide non publiable (no_root)", !emptyReport.publishable);

  // 3. Met un contenu valide dans le draft.
  const contentV1 = buildContent(bundle.slug, "Version 1");
  await prisma.decisionTree.update({
    where: { id: tree.id },
    data: { draftContent: contentV1 as unknown as Prisma.InputJsonValue },
  });
  const reportV1 = await validateTreeContentAgainstDb(contentV1);
  check("contenu valide publiable", reportV1.publishable);

  // 4. Publication v1.
  const pub1 = await publishTree(tree.id, ACTOR, "Première publication");
  check("publication v1 ok", pub1.ok === true);
  check("v1 = version 1", pub1.ok === true && pub1.version === 1);

  const afterPub = await prisma.decisionTree.findUnique({
    where: { id: tree.id },
  });
  check("status = published", afterPub?.status === "published");
  check("publishedContent rempli", afterPub?.publishedContent != null);
  check("publishedRevisionId rempli", afterPub?.publishedRevisionId != null);

  // 5. Modifie le draft puis re-publie → v2 + diff modifié.
  const contentV2 = buildContent(bundle.slug, "Version 2 — label changé");
  await prisma.decisionTree.update({
    where: { id: tree.id },
    data: { draftContent: contentV2 as unknown as Prisma.InputJsonValue },
  });
  const pub2 = await publishTree(tree.id, ACTOR, "Modif label");
  check("publication v2 ok", pub2.ok === true);
  check("v2 = version 2", pub2.ok === true && pub2.version === 2);

  const revs = await prisma.decisionTreeRevision.findMany({
    where: { treeId: tree.id },
    orderBy: { version: "desc" },
  });
  check("2 révisions enregistrées", revs.length === 2);
  const v2rev = revs.find((r) => r.version === 2);
  const diff = v2rev?.diffSummary as { modified?: string[] } | null;
  check(
    "diff v2 contient opt_a modifié",
    Array.isArray(diff?.modified) && diff!.modified!.includes("opt_a"),
  );

  // 6. Restaure la v1 vers le draft.
  const v1rev = revs.find((r) => r.version === 1)!;
  const restore = await restoreRevisionToDraft(tree.id, v1rev.id, ACTOR);
  check("restauration v1 ok", restore.ok === true);
  const afterRestore = await prisma.decisionTree.findUnique({
    where: { id: tree.id },
  });
  const draftLabel = (
    afterRestore?.draftContent as unknown as DecisionTreeContent
  )?.nodes?.opt_a;
  check(
    "draft restauré au label v1",
    draftLabel?.type === "option" && draftLabel.label === "Version 1",
  );
  const publishedLabel = (
    afterRestore?.publishedContent as unknown as DecisionTreeContent
  )?.nodes?.opt_a;
  check(
    "publishedContent inchangé (toujours v2)",
    publishedLabel?.type === "option" &&
      publishedLabel.label === "Version 2 — label changé",
  );

  // 7. Cleanup.
  await cleanup();
  const gone = await prisma.decisionTree.findUnique({ where: { slug: SLUG } });
  check("arbre supprimé (cleanup)", gone === null);

  console.log(
    failures === 0
      ? "\n✅ Smoke test PASSED"
      : `\n❌ Smoke test FAILED (${failures} échec(s))`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await cleanup().catch(() => {});
  process.exit(1);
});
