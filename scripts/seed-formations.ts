// Seed du module Docbel Formations : catégories, tags, badges, branches +
// questions de la Boussole, et un jeu de démonstration. Idempotent.
//   pnpm seed:formations
import { PrismaClient } from "@prisma/client";
import { seedFormations } from "../prisma/seeds/formations";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Docbel Formations…");
  await seedFormations(prisma);
  console.log("✓ Docbel Formations seedé.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
