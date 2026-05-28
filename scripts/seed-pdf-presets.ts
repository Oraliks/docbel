// Sème (ou met à jour) les presets de champs intégrés.
// Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-pdf-presets.ts
import { PrismaClient, Prisma } from "@prisma/client";
import { BUILTIN_PRESETS } from "../lib/pdf-forms/presets";

const prisma = new PrismaClient();

async function main() {
  for (const p of BUILTIN_PRESETS) {
    await prisma.pdfFieldPreset.upsert({
      where: { key: p.key },
      update: {
        label: p.label,
        fieldType: p.fieldType,
        regex: p.regex ?? null,
        errorMsg: (p.errorMsg as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        helpText: (p.helpText as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        maxLength: p.maxLength ?? null,
        builtin: true,
      },
      create: {
        key: p.key,
        label: p.label,
        fieldType: p.fieldType,
        regex: p.regex ?? null,
        errorMsg: (p.errorMsg as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        helpText: (p.helpText as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        maxLength: p.maxLength ?? null,
        builtin: true,
      },
    });
  }
  console.log(`✓ ${BUILTIN_PRESETS.length} presets PDF Forms semés.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
