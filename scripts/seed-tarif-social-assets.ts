/**
 * Seed initial des sources officielles pour le calculateur Tarif social énergie.
 *
 * Ces URLs pointent vers les organismes officiels de l'État belge à
 * consulter pour la maintenance des barèmes (CREG trimestrielle + liste
 * SPF Économie + texte AR Moniteur belge). L'admin peut ensuite ajouter
 * ses propres PDFs uploadés via /admin/chomage/outils/calculateurs/tarif-social-energie.
 *
 * Sources publiques EXCLUSIVEMENT officielles : CREG (autorité de
 * régulation), SPF Économie, Moniteur belge. Aucun fournisseur privé ni
 * simulateur concurrent — voir mémo de l'équipe Docbel.
 *
 * Idempotent : suppression préalable des entrées URL existantes pour ce
 * slug ; conserve les PDFs uploadés par l'admin (kind="pdf").
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-tarif-social-assets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "tarif-social-energie";

const ASSETS = [
  {
    label: "CREG — Tarif social pour l'énergie (page officielle)",
    description:
      "Page hub de la Commission de Régulation de l'Électricité et du Gaz : tarifs sociaux maximaux trimestriels pour l'électricité (monohoraire, bihoraire jour/nuit, exclusif nuit) et le gaz naturel. Référence officielle pour vérifier la note CREG de chaque trimestre (Q1/Q2/Q3/Q4).",
    url: "https://www.creg.be/fr/consommateurs/prix-et-tarifs/tarif-social/tarif-social-pour-lenergie",
    category: "tarif-elec",
    year: 2026,
    order: 10,
  },
  {
    label: "CREG — Note Z3153 (prix maximaux sociaux Q1 2026)",
    description:
      "Note CREG officielle fixant les prix maximaux sociaux pour l'électricité, le gaz naturel et la chaleur applicables au 1ᵉʳ trimestre 2026. Source légale principale pour le calcul du tarif social (article 4 AR 28.06.2009). Réactualisée chaque trimestre — surveiller les notes Z31xx suivantes.",
    url: "https://www.creg.be/fr/publications/note-z3153",
    category: "tarif-gaz",
    year: 2026,
    order: 20,
  },
  {
    label: "SPF Économie — Tarif social pour l'énergie",
    description:
      "Service Public Fédéral Économie : page officielle reprenant les bénéficiaires automatiques du tarif social en 2026 (RIS, GRAPA, allocation handicap DG HAN, aide CPAS équivalente, logement social agréé). Précise que le statut BIM n'ouvre plus le droit seul depuis le 1ᵉʳ juillet 2023.",
    url: "https://economie.fgov.be/fr/themes/energie/energie-sociale/tarif-social-pour-lenergie",
    category: "beneficiaires",
    year: 2026,
    order: 30,
  },
  {
    label: "Moniteur belge — AR du 29 mars 2012",
    description:
      "Arrêté royal du 29 mars 2012 fixant les règles de détermination du coût d'application des tarifs sociaux par les entreprises d'électricité et de gaz, et les règles d'intervention pour leur prise en charge. Modifié par l'AR du 5 mars 2021. Référence pour les plafonds de consommation au-delà desquels le tarif standard s'applique.",
    url: "https://www.ejustice.just.fgov.be",
    category: "legal",
    year: 2012,
    order: 40,
  },
  {
    label: "CREG — Tarif social (page index)",
    description:
      "Page index de la CREG sur le tarif social : explication du mécanisme automatique, lien vers les notes trimestrielles archivées et les rapports annuels. Utile pour comprendre l'évolution historique des prix maximaux sociaux et préparer la maintenance annuelle.",
    url: "https://www.creg.be/fr/consommateurs/prix-et-tarifs/tarif-social",
    category: "general",
    year: 2026,
    order: 50,
  },
];

async function main() {
  console.log(`Seed assets pour ${SLUG}…`);

  // Nettoyage des entrées URL précédentes (idempotence). On ne supprime PAS
  // les PDFs uploadés par l'admin (kind="pdf") pour ne pas perdre son travail.
  const deleted = await prisma.calculatorAsset.deleteMany({
    where: { slug: SLUG, kind: "url" },
  });
  console.log(`   - ${deleted.count} entrée(s) URL supprimée(s) (idempotence)`);

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
    console.log(`   + ${a.label}`);
    created++;
  }

  console.log(`\nTerminé — ${created} sources URL ajoutées pour ${SLUG}.`);
}

main()
  .catch((e) => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
