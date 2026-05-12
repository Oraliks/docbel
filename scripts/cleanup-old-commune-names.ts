import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Supprime les bureaux COMMUNE dont le nom commence par "Hôtel de Ville",
  // "Stadhuis" ou "Rathaus" (anciens noms remplacés par "Commune de ...").
  const result = await prisma.bureau.deleteMany({
    where: {
      type: "COMMUNE",
      OR: [
        { name: { startsWith: "Hôtel de Ville" } },
        { name: { startsWith: "Stadhuis " } },
        { name: { startsWith: "Rathaus " } },
      ],
    },
  });
  console.log(`✓ ${result.count} ancien(s) bureau(x) supprimé(s)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
