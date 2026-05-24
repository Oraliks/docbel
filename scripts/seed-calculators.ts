/**
 * Seed des 9 calculateurs citoyens dans la table `Tool` (Prisma).
 *
 * Pourquoi ce script : les calcs vivaient dans `lib/docbel-data.ts` (statique)
 * et n'étaient pas éditables côté admin. En les insérant en DB sous une
 * section dédiée "Calculateurs", on permet à l'admin :
 *   1. d'éditer title / description / popularité / activation via l'UI
 *      existante (composant `ToolsAdminWorkspace` → API `/api/tools/[slug]`) ;
 *   2. d'accéder à la méthodologie technique de chaque calc via le bouton
 *      "Méthodologie" qui mène à /admin/chomage/outils/calculateurs/[slug].
 *
 * La logique de calcul (formules, constantes) reste en code sous
 * `lib/calculators/*.ts` — c'est de la source de vérité technique, pas du
 * contenu éditorial.
 *
 * Idempotent : utilise `upsert` sur le slug. On peut le relancer en sécurité.
 *
 * Usage :
 *   pnpm tsx scripts/seed-calculators.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Données alignées avec TOOLS_DATA dans lib/docbel-data.ts (slugs identiques). */
const CALCULATORS = [
  {
    slug: "brut-net",
    name: "Brut ↔ Net",
    description:
      "Convertissez votre salaire brut en net (ou inversement) selon votre statut familial, votre région et vos avantages.",
    type: "calc_brut_net",
    icon: "Wallet",
    popular: true,
    timeMin: 2,
    order: 10,
  },
  {
    slug: "pecule-vacances",
    name: "Pécule de vacances",
    description:
      "Estimez votre pécule simple et double (employé ou ouvrier) en fonction de votre salaire et de votre ancienneté.",
    type: "calc_pecule",
    icon: "Plane",
    popular: true,
    timeMin: 2,
    order: 20,
  },
  {
    slug: "allocations-chomage",
    name: "Allocations de chômage",
    description:
      "Calculez votre allocation mensuelle de chômage selon votre situation familiale, votre salaire et votre durée de chômage.",
    type: "calc_chomage",
    icon: "Coins",
    popular: true,
    timeMin: 3,
    order: 30,
  },
  {
    slug: "indemnite-rupture",
    name: "Indemnité de rupture",
    description:
      "Convertissez votre préavis non presté en indemnité compensatoire (€). Complément du calculateur de préavis.",
    type: "calc_indemnite",
    icon: "FileSignature",
    popular: false,
    timeMin: 2,
    order: 40,
  },
  {
    slug: "pension-estimation",
    name: "Pension légale estimée",
    description:
      "Estimation simplifiée de votre pension légale salarié selon votre carrière, votre salaire moyen et votre âge de départ.",
    type: "calc_pension",
    icon: "Hourglass",
    popular: false,
    timeMin: 3,
    order: 50,
  },
  {
    slug: "allocations-familiales",
    name: "Allocations familiales",
    description:
      "Calculez vos allocations familiales selon votre région (FAMIWAL, FAMIRIS, Groeipakket, Kindergeld DG) et le rang de l'enfant.",
    type: "calc_allocs_fam",
    icon: "Baby",
    popular: true,
    timeMin: 2,
    order: 60,
  },
  {
    slug: "ipp-simulateur",
    name: "Impôt des personnes physiques",
    description:
      "Simulateur IPP simplifié : tranches d'imposition, quotité exemptée, enfants à charge et additionnels communaux.",
    type: "calc_ipp",
    icon: "Calculator",
    popular: true,
    timeMin: 3,
    order: 70,
  },
  {
    slug: "tarif-social-energie",
    name: "Tarif social énergie",
    description:
      "Vérifiez votre éligibilité au tarif social électricité/gaz et estimez votre gain par rapport au tarif standard.",
    type: "calc_tarif_social",
    icon: "Zap",
    popular: true,
    timeMin: 2,
    order: 80,
  },
  {
    slug: "frais-kilometriques",
    name: "Frais kilométriques",
    description:
      "Calculez la déduction fiscale de vos frais domicile-travail selon votre mode de transport (voiture, vélo, transports en commun).",
    type: "calc_km",
    icon: "Car",
    popular: false,
    timeMin: 2,
    order: 90,
  },
] as const;

async function main() {
  console.log("🌱 Seed calculateurs citoyens…");

  // 1) Section "Calculateurs" — créée si absente.
  const section = await prisma.toolSection.upsert({
    where: { name: "Calculateurs" },
    update: {
      description:
        "Simulateurs et calculateurs (brut/net, chômage, pension, allocs familiales, IPP, etc.)",
      icon: "Calculator",
      order: 2,
    },
    create: {
      name: "Calculateurs",
      description:
        "Simulateurs et calculateurs (brut/net, chômage, pension, allocs familiales, IPP, etc.)",
      icon: "Calculator",
      order: 2,
    },
  });
  console.log(`   ✓ Section "${section.name}" prête (id=${section.id})`);

  // 2) 9 calcs en upsert. On met à jour les champs éditoriaux sans toucher
  //    à `active` (l'admin a peut-être désactivé l'outil) ni à `popular`
  //    (idem). Si l'outil est nouveau, on prend les valeurs par défaut du
  //    seed.
  let created = 0;
  let updated = 0;
  for (const calc of CALCULATORS) {
    const result = await prisma.tool.upsert({
      where: { slug: calc.slug },
      update: {
        // On ré-aligne uniquement les champs "structurels" : type, icon,
        // section, order. Pas le name/description (l'admin peut les avoir
        // édités). Pas popular/active (préférences admin).
        type: calc.type,
        icon: calc.icon,
        sectionId: section.id,
        order: calc.order,
        timeMin: calc.timeMin,
      },
      create: {
        sectionId: section.id,
        name: calc.name,
        slug: calc.slug,
        description: calc.description,
        type: calc.type,
        icon: calc.icon,
        popular: calc.popular,
        timeMin: calc.timeMin,
        order: calc.order,
        active: true,
      },
    });

    // Heuristique : si createdAt et updatedAt sont quasi identiques (< 2s),
    // c'est une création. Sinon, c'est un update.
    const isFresh =
      result.updatedAt.getTime() - result.createdAt.getTime() < 2000;
    if (isFresh) {
      console.log(`   ✓ créé : ${calc.name}`);
      created++;
    } else {
      console.log(`   ↻ mis à jour : ${calc.name}`);
      updated++;
    }
  }

  console.log(
    `\n✅ Terminé — ${created} créé(s), ${updated} mis à jour. Section : "${section.name}".`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Erreur seed :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
