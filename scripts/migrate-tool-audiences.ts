/**
 * Migration des données : aligne le champ `Tool.audience` (DB) pour les outils
 * déjà seedés avec leur audience réelle.
 *
 * Règle métier (cf. lib/audience.ts) :
 *   - "citoyen"   → visible par tous (citoyen, employeur, partenaire)
 *   - "employeur" → visible par employeur + partenaire
 *   - "partenaire"→ visible uniquement par partenaire
 *
 * Outils impactés :
 *   - preavis             → "citoyen"
 *   - bureaux             → "citoyen"
 *   - lookup-onem         → "partenaire" (réservé aux pros, cf. TOOLS_DATA)
 *   - tous les calc_*     → "citoyen" par défaut
 *
 * Tous les autres outils restent à leur valeur par défaut ("citoyen").
 *
 * Idempotent — peut être relancé sans risque.
 *
 * Usage :
 *   pnpm dotenv -e .env.local -- tsx scripts/migrate-tool-audiences.ts
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type Audience = "citoyen" | "employeur" | "partenaire";

/** Audiences explicites par slug. Tout ce qui n'est pas listé reste à
 *  l'audience par défaut "citoyen". */
const AUDIENCE_BY_SLUG: Record<string, Audience> = {
  // Outils citoyens explicites (déjà default mais on les pose pour traçabilité)
  preavis: "citoyen",
  bureaux: "citoyen",

  // Outils partenaires (réservés aux pros)
  "lookup-onem": "partenaire",
};

async function main() {
  console.log("🌱 Migration audiences outils…");

  // 1) Récupère tous les outils (via raw SQL pour s'affranchir du cache client
  //    Prisma sur Windows qui peut ne pas voir audience tout de suite après
  //    la migration).
  const tools = await prisma.$queryRaw<
    { slug: string; type: string; audience: string }[]
  >`SELECT slug, type, audience FROM "Tool"`;

  console.log(`   → ${tools.length} outil(s) en DB`);

  let updated = 0;
  let unchanged = 0;

  for (const tool of tools) {
    // Détermine l'audience cible :
    //   1. mapping explicite par slug
    //   2. sinon, citoyen pour les calc_*
    //   3. sinon, on laisse tel quel
    let target: Audience | null = AUDIENCE_BY_SLUG[tool.slug] ?? null;
    if (!target && tool.type.startsWith("calc_")) {
      target = "citoyen";
    }
    if (!target) {
      unchanged++;
      continue;
    }

    if (tool.audience === target) {
      console.log(`   = ${tool.slug.padEnd(28)} ${tool.audience} (inchangé)`);
      unchanged++;
      continue;
    }

    await prisma.$executeRaw(Prisma.sql`
      UPDATE "Tool"
      SET audience = ${target}, "updatedAt" = NOW()
      WHERE slug = ${tool.slug}
    `);
    console.log(
      `   ✓ ${tool.slug.padEnd(28)} ${tool.audience} → ${target}`,
    );
    updated++;
  }

  console.log(
    `\n✅ Terminé — ${updated} mis à jour, ${unchanged} inchangé(s).`,
  );
}

main()
  .catch((err) => {
    console.error("❌ Erreur :", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
