/**
 * One-shot : renomme l'outil "Localiser une antenne ONEM" en "Trouver un bureau"
 * et change son slug `localiser-onem` → `bureaux`.
 *
 * Idempotent : si le slug `bureaux` existe déjà, on ne fait rien.
 *
 * Usage : `npx tsx scripts/rename-locator-slug.ts`
 */
import { prisma } from "../lib/prisma";

async function main() {
  const target = await prisma.tool.findUnique({ where: { slug: "bureaux" } });
  if (target) {
    console.log(`[rename-locator-slug] OK — outil "bureaux" déjà présent (id=${target.id}).`);
    return;
  }

  const old = await prisma.tool.findUnique({ where: { slug: "localiser-onem" } });
  if (!old) {
    console.log(`[rename-locator-slug] Rien à faire — pas d'outil "localiser-onem" trouvé.`);
    return;
  }

  const updated = await prisma.tool.update({
    where: { id: old.id },
    data: {
      slug: "bureaux",
      name: "Trouver un bureau",
      description:
        "CPAS, Commune, ONEM, organismes de paiement, syndicats : un seul outil pour tout trouver, partout en Belgique.",
      popular: true,
    },
  });
  console.log(`[rename-locator-slug] OK — "${old.slug}" → "${updated.slug}" (id=${updated.id}).`);
}

main()
  .catch((e) => {
    console.error("[rename-locator-slug] FAIL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
