/**
 * Seed initial des sources officielles pour le calculateur Allocations familiales.
 *
 * Ces URLs pointent vers les 6 organismes officiels de l'État belge à
 * consulter pour la maintenance annuelle des barèmes (un par région +
 * autorités de tutelle). L'admin peut ensuite ajouter ses propres PDFs
 * uploadés via /admin/chomage/outils/calculateurs/allocations-familiales.
 *
 * Sources publiques exclusivement officielles régionales (aucune caisse
 * privée ni simulateur concurrent — voir mémo de l'équipe).
 *
 * Idempotent : upsert sur (slug + url) via une suppression préalable
 * des entrées URL existantes pour ce slug.
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-allocs-fam-assets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "allocations-familiales";

const ASSETS = [
  {
    label: "FAMIWAL — Résumé des montants (Wallonie)",
    description:
      "Page officielle FAMIWAL avec les montants 2026 indexés au 1ᵉʳ mars : base nouveau régime (≥2020), ancien régime, suppléments sociaux et monoparentaux, prime de naissance. Indispensable pour la maintenance annuelle du barème wallon.",
    url: "https://www.famiwal.be/montants/resume-des-montants",
    category: "wallonie",
    year: 2026,
    order: 10,
  },
  {
    label: "AVIQ — Allocations familiales (autorité de tutelle Wallonie)",
    description:
      "Agence pour une Vie de Qualité — autorité publique wallonne qui supervise FAMIWAL et les caisses agréées. Référence pour les règles de fond, les conditions et la procédure de reconnaissance handicap.",
    url: "https://www.aviq.be/familles/",
    category: "wallonie",
    year: 2026,
    order: 20,
  },
  {
    label: "FAMIRIS — Montants des allocations familiales (Bruxelles)",
    description:
      "Page officielle FAMIRIS avec les montants 2026 indexés au 1ᵉʳ mars : base par tranche d'âge et année de naissance, supplément social par revenu et nombre d'enfants, supplément orphelin, prime de naissance.",
    url: "https://famiris.brussels/fr/faq/payments-amounts-of-child-benefits/child-benefit-rates/",
    category: "bruxelles",
    year: 2026,
    order: 30,
  },
  {
    label: "Iriscare — Allocations familiales (autorité de tutelle Bruxelles)",
    description:
      "Organisme bruxellois en charge de la sécurité sociale régionale. Supervise FAMIRIS et les caisses agréées à Bruxelles. Référence pour le supplément handicap (échelle Iriscare).",
    url: "https://www.iriscare.brussels",
    category: "bruxelles",
    year: 2026,
    order: 40,
  },
  {
    label: "Groeipakket — Montants 2026 (Flandre)",
    description:
      "Page officielle Groeipakket / Opgroeien (« paquet de croissance ») avec les montants 2026 indexés au 1ᵉʳ septembre : basisbedrag, sociale toeslagen par tranche de revenu et nombre d'enfants, zorgtoeslag, startbedrag, schoolbonus.",
    url: "https://www.groeipakket.be/fr/montants",
    category: "flandre",
    year: 2026,
    order: 50,
  },
  {
    label: "Ostbelgien Familie — Kindergeld DG (Communauté germanophone)",
    description:
      "Portail officiel du Ministerium der Deutschsprachigen Gemeinschaft pour le Kindergeld : Basiskindergeld, Sozialzuschlag, Familienzuschlag (large famille), Geburtszulage, Schulbonus.",
    url: "https://ostbelgienfamilie.be/desktopdefault.aspx/tabid-5900/",
    category: "germanophone",
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
