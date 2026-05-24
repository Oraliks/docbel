/**
 * Seed du Lookup ONEM en table `Tool` (Prisma).
 *
 * Différent de `seed-lookup-onem.ts` (qui seede les catégories/tables
 * internes du système Lookup) : ce script seede l'OUTIL `lookup-onem`
 * dans la table Tool, pour qu'il apparaisse dans /admin/chomage/outils
 * et soit désactivable depuis l'UI admin.
 *
 * L'outil reste à son emplacement actuel (/partenaire/lookup-onem) et
 * conserve son auth `requirePartnerOrAdminAuth`. Le seed permet juste à
 * l'admin de le désactiver/activer via le toggle sans toucher au code.
 *
 * Audience : "partenaire" — la hiérarchie audience le restreint aux
 * partenaires uniquement (cohérent avec l'auth de la page).
 *
 * Section : "Référentiels" (créée si absente).
 *
 * Idempotent. Usage :
 *   pnpm dotenv -e .env.local -- tsx scripts/seed-lookup-onem-tool.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seed Lookup ONEM (table Tool)…");

  const section = await prisma.toolSection.upsert({
    where: { name: "Référentiels" },
    update: {},
    create: {
      name: "Référentiels",
      description:
        "Dictionnaires de codes officiels et bases de données (Lookup ONEM, etc.)",
      icon: "Database",
      order: 4,
    },
  });
  console.log(`   ✓ Section "${section.name}" prête (id=${section.id})`);

  const result = await prisma.tool.upsert({
    where: { slug: "lookup-onem" },
    update: {
      type: "lookup",
      icon: "Search",
      sectionId: section.id,
      order: 10,
      timeMin: null,
      audience: "partenaire",
    },
    create: {
      sectionId: section.id,
      name: "Lookup ONEM",
      slug: "lookup-onem",
      description:
        "Décodage de tous les codes officiels ONEM (S01, S04, S38, Dispo, BCSS…). Recherche fuzzy multilingue FR/NL/DE/EN dans 11 000+ entrées.",
      type: "lookup",
      icon: "Search",
      popular: true,
      timeMin: null,
      order: 10,
      active: true,
      audience: "partenaire",
    },
  });

  const isFresh =
    result.updatedAt.getTime() - result.createdAt.getTime() < 2000;
  console.log(
    isFresh ? `   ✓ créé : ${result.name}` : `   ↻ mis à jour : ${result.name}`,
  );
  console.log(
    `\n✅ Terminé — audience: "${result.audience}" (visible uniquement partenaires + admin).`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
