import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const prefixed = await prisma.changelog.findMany({
    where: { version: { startsWith: "v" } },
    select: { id: true, version: true, title: true },
  });

  if (prefixed.length === 0) {
    console.log("Aucune entrée à corriger (rien ne commence par 'v').");
    return;
  }

  console.log(`🔧 ${prefixed.length} entrée(s) à corriger :`);
  let fixed = 0;
  let skipped = 0;

  for (const entry of prefixed) {
    const newVersion = entry.version.replace(/^v+/, "");

    if (newVersion === entry.version) {
      continue;
    }

    if (newVersion === "") {
      console.log(`   ! skip ${entry.version} (vide après strip)`);
      skipped++;
      continue;
    }

    const conflict = await prisma.changelog.findUnique({
      where: { version: newVersion },
      select: { id: true },
    });

    if (conflict && conflict.id !== entry.id) {
      console.log(`   ! skip ${entry.version} → ${newVersion} (existe déjà)`);
      skipped++;
      continue;
    }

    await prisma.changelog.update({
      where: { id: entry.id },
      data: { version: newVersion },
    });
    console.log(`   ✓ ${entry.version} → ${newVersion}`);
    fixed++;
  }

  console.log(`\nDone. ${fixed} corrigée(s), ${skipped} ignorée(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
