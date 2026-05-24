/**
 * Seed des outils de référentiel (commissions paritaires + U1) en table
 * `Tool`. Ces outils ont leur propre route dédiée (`/outils/commissions-
 * paritaires`, `/outils/u1`) mais n'étaient pas en DB → impossible de les
 * désactiver depuis l'admin.
 *
 * Idempotent — relançable en sécurité.
 *
 * Usage :
 *   pnpm dotenv -e .env.local -- tsx scripts/seed-referentiels.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REFERENTIELS = [
  {
    slug: "commissions-paritaires",
    name: "Commissions paritaires",
    description:
      "Liste officielle des commissions paritaires (CP) et sous-commissions belges, avec recherche par code, numéro ou secteur.",
    type: "info",
    icon: "Users",
    popular: false,
    timeMin: 1,
    order: 20,
  },
  {
    slug: "u1",
    name: "Institutions U1 (EEE)",
    description:
      "Trouvez l'institution compétente dans chaque pays de l'EEE et en Suisse pour demander votre attestation U1 (ex-E301), l'équivalent européen du C4.",
    type: "info",
    icon: "Globe",
    popular: false,
    timeMin: 2,
    order: 30,
  },
] as const;

async function main() {
  console.log("🌱 Seed référentiels (commissions paritaires + U1)…");

  // 1) Section "Organismes" — doit déjà exister (créée précédemment par la
  //    réorga sections).
  const section = await prisma.toolSection.upsert({
    where: { name: "Organismes" },
    update: {},
    create: {
      name: "Organismes",
      description:
        "Bureaux et organismes publics (ONEM, CPAS, commune, etc.)",
      icon: "MapPin",
      order: 1,
    },
  });
  console.log(`   ✓ Section "${section.name}" prête (id=${section.id})`);

  let created = 0;
  let updated = 0;
  for (const tool of REFERENTIELS) {
    const result = await prisma.tool.upsert({
      where: { slug: tool.slug },
      update: {
        type: tool.type,
        icon: tool.icon,
        sectionId: section.id,
        order: tool.order,
        timeMin: tool.timeMin,
      },
      create: {
        sectionId: section.id,
        name: tool.name,
        slug: tool.slug,
        description: tool.description,
        type: tool.type,
        icon: tool.icon,
        popular: tool.popular,
        timeMin: tool.timeMin,
        order: tool.order,
        active: true,
      },
    });
    const isFresh =
      result.updatedAt.getTime() - result.createdAt.getTime() < 2000;
    if (isFresh) {
      console.log(`   ✓ créé : ${tool.name}`);
      created++;
    } else {
      console.log(`   ↻ mis à jour : ${tool.name}`);
      updated++;
    }
  }

  console.log(`\n✅ Terminé — ${created} créé(s), ${updated} mis à jour.`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
