/// Runner ciblé du seed Decision Builder (sans lancer tout prisma/seed.ts).
/// Par défaut, prépare uniquement le brouillon. `--publish` valide puis publie
/// explicitement le brouillon préparé.
///
/// Lancer :
///   pnpm exec dotenv -e .env.local -- tsx scripts/seed-decision-trees.ts
///   $env:DOCBEL_PUBLISH_DECISION_TREE="1"; pnpm exec dotenv -e .env.local -- tsx scripts/seed-decision-trees.ts

import { PrismaClient } from "@prisma/client";
import { seedDecisionTrees } from "../prisma/seeds/decision-trees";
import { publishTree } from "../lib/decision-builder/server";
import { hasUnpublishedTreeChanges } from "../lib/decision-builder/diff";
import { parseTreeContent } from "../lib/decision-builder/schema";

const prisma = new PrismaClient();
const PUBLISH =
  process.argv.includes("--publish") ||
  process.env.DOCBEL_PUBLISH_DECISION_TREE === "1";

async function main() {
  await seedDecisionTrees(prisma);
  if (!PUBLISH) return;

  const tree = await prisma.decisionTree.findUnique({
    where: { slug: "chomage-orientation" },
    select: { id: true, draftContent: true, publishedContent: true },
  });
  if (!tree) throw new Error("Arbre chomage-orientation introuvable après seed.");
  const draft = parseTreeContent(tree.draftContent);
  const publishedContent = tree.publishedContent
    ? parseTreeContent(tree.publishedContent)
    : null;
  if (!hasUnpublishedTreeChanges(draft, publishedContent)) {
    console.log("   = brouillon déjà identique à la version publiée");
    return;
  }

  const published = await publishTree(
    tree.id,
    "seed",
    "Ajout du parcours C1 — changement de situation personnelle.",
    "minor",
  );
  if (!published.ok) {
    if (published.reason === "not_publishable") {
      throw new Error(
        `Arbre non publiable : ${published.report.errors
          .map((error) => error.message)
          .join(" | ")}`,
      );
    }
    throw new Error(`Publication impossible : ${published.reason}`);
  }
  console.log(
    `   ✓ arbre validé et publié (v${published.version}, ${published.report.warnings.length} avertissement(s))`,
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
