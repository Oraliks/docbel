import { prisma } from "../lib/prisma";

async function seedFiles() {
  console.log("Seeding files...");

  // Clear existing files
  await prisma.fileUsage.deleteMany();
  await prisma.file.deleteMany();

  // Create root public folders
  const publicDocs = await prisma.file.create({
    data: {
      name: "Documents publics",
      type: "folder",
      isPrivate: false,
      createdBy: "system",
    },
  });

  const publicResources = await prisma.file.create({
    data: {
      name: "Ressources",
      type: "folder",
      isPrivate: false,
      createdBy: "system",
    },
  });

  // Create root private folders
  const privateDocs = await prisma.file.create({
    data: {
      name: "Documents privés",
      type: "folder",
      isPrivate: true,
      createdBy: "system",
    },
  });

  const privateBackup = await prisma.file.create({
    data: {
      name: "Sauvegardes",
      type: "folder",
      isPrivate: true,
      createdBy: "system",
    },
  });

  console.log("✅ File seeding complete");
  console.log(`Created ${4} folders`);
}

seedFiles()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
