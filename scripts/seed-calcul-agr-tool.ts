/**
 * Seed du Calcul AGR en table `Tool` (Prisma).
 *
 * Enregistre l'OUTIL `calcul-agr` dans la table Tool, pour qu'il :
 *   - apparaisse dans le tableau de bord partenaire (/partenaire, section
 *     « Outils ») qui lit le catalogue DB filtré pour l'audience partenaire ;
 *   - soit gérable (activer/désactiver, revue annuelle) depuis l'admin.
 *
 * L'outil reste à son emplacement `/partenaire/outils/calcul-agr` (shell
 * partenaire) avec son auth FGTB+admin. La carte du catalogue pointe vers
 * `/outils/calcul-agr` (slug standard) qui redirige vers cette page.
 *
 * Audience : "partenaire" (visible partenaires + admin ; l'accès FGTB-only
 * est appliqué par la page elle-même).
 *
 * Idempotent. Usage :
 *   pnpm dotenv -e .env.local -- tsx scripts/seed-calcul-agr-tool.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed Calcul AGR (table Tool)…");

  const section = await prisma.toolSection.upsert({
    where: { name: "Calculateurs" },
    update: {},
    create: {
      name: "Calculateurs",
      description:
        "Calculs et simulations chômage (AGR, préavis, allocations…).",
      icon: "Calculator",
      order: 2,
    },
  });
  console.log(`   ✓ Section "${section.name}" prête (id=${section.id})`);

  const result = await prisma.tool.upsert({
    where: { slug: "calcul-agr" },
    update: {
      type: "calc_agr",
      icon: "Calculator",
      sectionId: section.id,
      order: 10,
      timeMin: null,
      audience: "partenaire",
    },
    create: {
      sectionId: section.id,
      name: "Calcul AGR",
      slug: "calcul-agr",
      description:
        "Calcul de l'Allocation de Garantie de Revenus à partir d'un WECH 506 : upload de la DRS, extraction et calcul automatiques, cumul jusqu'à 4 occupations.",
      type: "calc_agr",
      icon: "Calculator",
      popular: false,
      timeMin: null,
      order: 10,
      active: true,
      audience: "partenaire",
    },
  });

  const isFresh = result.updatedAt.getTime() - result.createdAt.getTime() < 2000;
  console.log(
    isFresh ? `   ✓ créé : ${result.name}` : `   ↻ mis à jour : ${result.name}`,
  );
  console.log(`\n✅ Terminé — audience: "${result.audience}" (partenaires + admin).`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
