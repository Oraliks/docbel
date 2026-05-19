/// Re-run du seed des FieldValidationPreset canoniques en standalone.
///
/// La logique vit dans `prisma/seeds/field-validation-presets.ts` (source unique,
/// utilisée aussi par `pnpm seed`). Ce script est un thin wrapper pour les cas
/// où on veut juste rafraîchir les presets sans tout re-seed.
///
/// Usage : `pnpm seed:canonical`

import { PrismaClient } from "@prisma/client";
import { seedFieldValidationPresets } from "../prisma/seeds/field-validation-presets";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding canonical field presets…\n");
  await seedFieldValidationPresets(prisma);
  console.log("\n✅ Done.");
}

main()
  .catch((err) => {
    console.error("❌ Erreur :", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
