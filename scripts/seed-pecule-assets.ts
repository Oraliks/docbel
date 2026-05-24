/**
 * Seed initial des sources officielles pour le calculateur Pécule de vacances.
 *
 * Ces URLs pointent vers les pages officielles à consulter pour la
 * maintenance annuelle des barèmes pécule (régime employé et ONVA).
 * L'admin peut ensuite ajouter ses propres PDFs uploadés via
 * /admin/chomage/outils/calculateurs/pecule-vacances.
 *
 * Idempotent : upsert sur (slug + url) via une suppression préalable
 * des entrées URL existantes pour ce slug.
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-pecule-assets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "pecule-vacances";

const ASSETS = [
  {
    label:
      "SPF Finances — Précompte spécial double pécule (Annexe III AR/CIR 92)",
    description:
      "Barème officiel SPF Finances 2026 « pécule de vacances » (simple) et « allocations exceptionnelles » (double). 11 tranches dégressives, de 0 à 53,50 %. Publié chaque année à mi-décembre, applicable au 1ᵉʳ janvier.",
    url: "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
    category: "precompte",
    year: 2026,
    order: 10,
  },
  {
    label: "ONVA — Calcul du pécule de vacances (ouvriers)",
    description:
      "Page officielle ONVA : taux global 15,38 % (8 % simple + 7,38 % double), majoration 1,08, retenue ONSS 13,07 % + solidarité 1 % + précompte 17,16 / 23,22 %.",
    url: "https://www.onva.fgov.be/fr/pecule-de-vacances/calcul-du-pecule-de-vacances",
    category: "onva",
    year: 2026,
    order: 20,
  },
  {
    label: "SPF Sécurité Sociale — Pécule de vacances",
    description:
      "Page de référence sur le régime légal du pécule (employé + ouvrier). Cadre juridique, droits, jours assimilés.",
    url: "https://www.socialsecurity.be",
    category: "general",
    year: 2026,
    order: 30,
  },
  {
    label: "ONEM — Vacances-jeunes (formulaire C103)",
    description:
      "Conditions et procédure pour le pécule des jeunes travailleurs (< 25 ans, 1re année après études). Allocation 65 % du salaire plafonné par jour de vacances-jeunes, à demander avant fin février N+1.",
    url: "https://www.onem.be/citoyens/conges/avez-vous-droit-aux-vacances-jeunes-",
    category: "onem",
    year: 2026,
    order: 40,
  },
  {
    label: "ONSS — Instructions administratives (notion de rémunération)",
    description:
      "Documentation officielle ONSS sur l'inclusion du pécule dans la base de cotisation. Référence pour la cotisation ONSS spéciale 13,07 % sur double pécule.",
    url: "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/salary/particularcases/holidaypay.html",
    category: "onss",
    year: 2026,
    order: 50,
  },
  {
    label: "SPF Emploi — Vacances annuelles",
    description:
      "Cadre légal général des vacances annuelles : durée, jours assimilés, droit au pécule en cas de fin de contrat.",
    url: "https://emploi.belgique.be",
    category: "general",
    year: 2026,
    order: 60,
  },
];

async function main() {
  console.log(`🌱 Seed assets pour ${SLUG}…`);

  // Nettoyage des entrées URL précédentes (idempotence). On ne supprime PAS
  // les PDFs uploadés par l'admin (kind="pdf") pour ne pas perdre son travail.
  const deleted = await prisma.calculatorAsset.deleteMany({
    where: { slug: SLUG, kind: "url" },
  });
  console.log(`   ↻ ${deleted.count} entrée(s) URL supprimée(s) (idempotence)`);

  let created = 0;
  for (const a of ASSETS) {
    await prisma.calculatorAsset.create({
      data: {
        slug: SLUG,
        kind: "url",
        label: a.label,
        description: a.description,
        url: a.url,
        category: a.category,
        year: a.year,
        order: a.order,
      },
    });
    console.log(`   ✓ ${a.label}`);
    created++;
  }

  console.log(`\n✅ Terminé — ${created} sources URL ajoutées pour ${SLUG}.`);
}

main()
  .catch((e) => {
    console.error("❌ Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
