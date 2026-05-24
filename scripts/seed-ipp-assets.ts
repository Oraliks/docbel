/**
 * Seed initial des sources officielles pour le calculateur IPP — exercice
 * d'imposition 2026 (revenus 2025).
 *
 * Ces URLs pointent vers les organismes publics belges de référence pour
 * la maintenance annuelle des barèmes (tranches IPP, quotité exemptée,
 * suppléments enfants, cotisation spéciale sécu, additionnels communaux).
 * L'admin peut ensuite ajouter ses propres PDFs uploadés via
 * /admin/chomage/outils/calculateurs/ipp-simulateur.
 *
 * Sources publiques EXCLUSIVEMENT officielles de l'État belge — aucun
 * simulateur privé ni concurrent, conformément à la directive Docbel.
 *
 * Idempotent : suppression préalable des entrées URL existantes pour ce slug.
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-ipp-assets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "ipp-simulateur";

const ASSETS = [
  {
    label: "SPF Finances — Taux d'imposition (barème IPP)",
    description:
      "Page officielle du SPF Finances présentant les 4 tranches du barème fédéral de l'impôt des personnes physiques pour l'exercice d'imposition 2026 (revenus 2025) : 25 % jusqu'à 16 320 €, 40 % jusqu'à 28 800 €, 45 % jusqu'à 49 840 €, 50 % au-delà. Référence pour la mise à jour annuelle des tranches indexées.",
    url: "https://fin.belgium.be/fr/particuliers/declaration_impot/taux-imposition-revenus/taux-imposition",
    category: "spf-finances",
    year: 2026,
    order: 10,
  },
  {
    label: "SPF Finances — Tax-on-web (déclaration en ligne)",
    description:
      "Portail officiel de déclaration en ligne du SPF Finances. C'est l'outil de référence pour le calcul officiel et personnalisé de l'IPP — chaque estimation produite par notre simulateur doit pouvoir être recalibrée ici par le contribuable.",
    url: "https://finances.belgium.be/fr/E-services/tax-on-web",
    category: "spf-finances",
    year: 2026,
    order: 20,
  },
  {
    label: "SPF Finances — Quotité exemptée et enfants à charge",
    description:
      "Page officielle détaillant la quotité du revenu exemptée d'impôt (10 910 € EI 2026, art. 131 CIR 92) et les suppléments cumulatifs pour personnes à charge : 1 980 € pour 1 enfant, 5 110 € pour 2, 11 440 € pour 3, 18 510 € pour 4, +7 070 € par enfant au-delà. Référence pour la mise à jour annuelle des suppléments.",
    url: "https://fin.belgium.be/fr/particuliers/declaration-impot/situation-personnelle/personnes-a-charge/enfants",
    category: "spf-finances",
    year: 2026,
    order: 30,
  },
  {
    label: "SPF Finances — Personnes à charge autres que des enfants",
    description:
      "Page officielle pour les suppléments à la quotité au titre des ascendants (parents, grands-parents) et autres personnes à charge : 5 950 € si 66 ans+ et en état de dépendance, 1 980 € pour les autres cas. Source pour la calibration du paramètre 'autres personnes à charge'.",
    url: "https://fin.belgium.be/fr/particuliers/declaration-impot/situation-personnelle/personnes-a-charge/autres",
    category: "spf-finances",
    year: 2026,
    order: 40,
  },
  {
    label: "SPF Finances — Épargne pension (panier de base)",
    description:
      "Réduction d'impôt épargne pension — art. 145 CIR 92. EI 2026 : 30 % sur versement annuel jusqu'à 1 050 € (panier de base), 25 % sur la tranche 1 050 → 1 350 € (panier majoré, sur option). Page officielle SPF Finances pour la calibration des plafonds.",
    url: "https://fin.belgium.be/fr/particuliers/avantages-fiscaux/epargne-pension",
    category: "spf-finances",
    year: 2026,
    order: 50,
  },
  {
    label: "Moniteur belge — CIR 92 (Code des impôts sur les revenus)",
    description:
      "Texte législatif intégral du CIR 92 sur le portail Justel du Moniteur belge. Articles 131 (quotité exemptée), 132 (suppléments à charge), 134 (quotient conjugal), 145 et suivants (réductions d'impôt). Référence juridique ultime pour toute modification du calcul.",
    url: "https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1992041252&table_name=loi",
    category: "moniteur",
    year: 2026,
    order: 60,
  },
  {
    label: "Moniteur belge — Loi du 30 mars 1994 (cotisation spéciale sécu)",
    description:
      "Loi-cadre instaurant la cotisation spéciale pour la sécurité sociale. Seuils 2026 : exonération sous 18 592 €/an, 9 % entre 18 592 et 21 070 €, 1,3 % entre 21 070 et 60 161 €, plafond annuel 731,28 €. Référence juridique pour la calibration des seuils CSS.",
    url: "https://www.ejustice.just.fgov.be/cgi_loi/change_lg.pl?language=fr&la=F&cn=1994033052&table_name=loi",
    category: "moniteur",
    year: 2026,
    order: 70,
  },
  {
    label: "ONSS — Instructions DmfA : cotisation spéciale sécu",
    description:
      "Instructions administratives ONSS 2026/1 sur la cotisation spéciale de sécurité sociale (code DmfA 856). Distingue imposition individuelle et conjointe, et donne les barèmes trimestriels précis. Source pour ajuster le calcul si la loi est révisée.",
    url: "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/specialsocialsecuritycontribution.html",
    category: "onss",
    year: 2026,
    order: 80,
  },
];

async function main() {
  console.log(`Seed assets pour ${SLUG}…`);

  // Nettoyage des entrées URL précédentes (idempotence). On ne supprime PAS
  // les PDFs uploadés par l'admin (kind="pdf") pour ne pas perdre son travail.
  const deleted = await prisma.calculatorAsset.deleteMany({
    where: { slug: SLUG, kind: "url" },
  });
  console.log(`   ${deleted.count} entree(s) URL supprimee(s) (idempotence)`);

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
    console.log(`   ok ${a.label}`);
    created++;
  }

  console.log(`\nTermine — ${created} sources URL ajoutees pour ${SLUG}.`);
}

main()
  .catch((e) => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
