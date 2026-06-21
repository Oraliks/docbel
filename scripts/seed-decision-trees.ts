/// Runner ciblé du seed Decision Builder (sans lancer tout prisma/seed.ts).
/// Lancer : pnpm exec dotenv -e .env.local -- tsx scripts/seed-decision-trees.ts

import { PrismaClient } from "@prisma/client";
import { seedDecisionTrees } from "../prisma/seeds/decision-trees";

const prisma = new PrismaClient();

seedDecisionTrees(prisma)
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
