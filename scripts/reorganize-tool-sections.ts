/**
 * Réorganise les sections des outils en DB selon les souhaits éditoriaux :
 *
 *  - "preavis" passe de la section "Chômage" à "Calculateurs" (il appartient
 *    visuellement à la famille des calculatrices, sa page admin de config
 *    reste accessible via le bouton "Configurer" de la card).
 *  - "lookup-onem" (s'il existe en DB) est mis dans une nouvelle section
 *    "Lookup" — créée si absente. Si lookup-onem n'est pas encore en DB
 *    (purement statique dans TOOLS_DATA), on crée juste la section vide
 *    prête à recevoir le seed futur.
 *
 * Idempotent — relançable en sécurité.
 *
 * Usage :
 *   pnpm dotenv -e .env.local -- tsx scripts/reorganize-tool-sections.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔧 Réorganisation des sections d'outils…");

  // 1) Section "Lookup" — créée si absente.
  const lookupSection = await prisma.toolSection.upsert({
    where: { name: "Lookup" },
    update: {
      description: "Bases de données de recherche et décodage (codes ONEM, etc.)",
      icon: "Search",
      order: 3,
    },
    create: {
      name: "Lookup",
      description: "Bases de données de recherche et décodage (codes ONEM, etc.)",
      icon: "Search",
      order: 3,
    },
  });
  console.log(`   ✓ Section "Lookup" prête (id=${lookupSection.id})`);

  // 2) Section "Calculateurs" — doit déjà exister (créée par seed-calculators).
  //    On l'upsert pour être safe.
  const calcSection = await prisma.toolSection.upsert({
    where: { name: "Calculateurs" },
    update: {},
    create: {
      name: "Calculateurs",
      description:
        "Simulateurs et calculateurs (brut/net, chômage, pension, allocs familiales, IPP, etc.)",
      icon: "Calculator",
      order: 2,
    },
  });

  // 3) Déplacement de "preavis" → Calculateurs
  const preavis = await prisma.tool.findUnique({ where: { slug: "preavis" } });
  if (preavis) {
    if (preavis.sectionId !== calcSection.id) {
      await prisma.tool.update({
        where: { id: preavis.id },
        data: { sectionId: calcSection.id, order: 5 }, // ordre 5 pour le mettre tôt dans la section
      });
      console.log(`   ✓ "preavis" déplacé vers Calculateurs`);
    } else {
      console.log(`   ↻ "preavis" déjà dans Calculateurs, ignoré`);
    }
  } else {
    console.log(`   ⚠ Pas de tool "preavis" en DB — skipped`);
  }

  // 4) Déplacement de "lookup-onem" → Lookup (si présent en DB)
  const lookup = await prisma.tool.findUnique({
    where: { slug: "lookup-onem" },
  });
  if (lookup) {
    if (lookup.sectionId !== lookupSection.id) {
      await prisma.tool.update({
        where: { id: lookup.id },
        data: { sectionId: lookupSection.id, order: 10 },
      });
      console.log(`   ✓ "lookup-onem" déplacé vers Lookup`);
    } else {
      console.log(`   ↻ "lookup-onem" déjà dans Lookup, ignoré`);
    }
  } else {
    console.log(
      `   ℹ "lookup-onem" n'est pas en DB (statique dans TOOLS_DATA). Section "Lookup" créée pour usage futur.`,
    );
  }

  // 5) Récapitulatif final
  const sections = await prisma.toolSection.findMany({
    include: { _count: { select: { tools: true } } },
    orderBy: { order: "asc" },
  });
  console.log("\n📋 État actuel des sections :");
  for (const s of sections) {
    console.log(`   - ${s.name} (${s._count.tools} outil${s._count.tools > 1 ? "s" : ""}) — order ${s.order}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
