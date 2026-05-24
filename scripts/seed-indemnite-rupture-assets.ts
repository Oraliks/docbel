/**
 * Seed initial des sources officielles pour le calculateur Indemnité de
 * rupture (préavis non presté).
 *
 * Ces URLs pointent vers les organismes publics belges de référence pour
 * la maintenance annuelle des barèmes (précompte spécial SPF Finances,
 * cotisation spéciale ONSS, indemnités de protection). L'admin peut
 * ensuite ajouter ses propres PDFs uploadés via
 * /admin/chomage/outils/calculateurs/indemnite-rupture.
 *
 * Sources publiques EXCLUSIVEMENT officielles de l'État belge — aucun
 * simulateur privé ni concurrent, conformément à la directive Docbel.
 *
 * Idempotent : upsert sur (slug + url) via une suppression préalable
 * des entrées URL existantes pour ce slug.
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-indemnite-rupture-assets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "indemnite-rupture";

const ASSETS = [
  {
    label: "SPF Finances — Précompte professionnel 2026 (calcul)",
    description:
      "Page officielle SPF Finances détaillant le calcul du précompte professionnel 2026, y compris le barème spécial applicable aux indemnités de dédit (arriérés et indemnités de fin de contrat). Page de référence pour la mise à jour annuelle du barème par tranches (17,16 / 26,75 / 32,30 / 41,80 / 53,50 %).",
    url: "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
    category: "spf-finances",
    year: 2026,
    order: 10,
  },
  {
    label: "ONSS — Cotisation spéciale sur indemnités de rupture (DmfA 2026/1)",
    description:
      "Instructions administratives ONSS 2026/1 pour la cotisation spéciale de compensation employeur sur les indemnités de rupture, destinée au Fonds de fermeture des entreprises. Précise les 3 tranches actuelles (≥ 50 166 € → 1 %, ≥ 61 437 € → 2 %, ≥ 72 707 € → 3 %), inchangées depuis le 01/01/2023.",
    url: "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/special_contributions/other_specialcontributions/terminationfeecontribution.html",
    category: "onss",
    year: 2026,
    order: 20,
  },
  {
    label: "ONSS — Notion de rémunération (fin de contrat)",
    description:
      "Instructions ONSS 2026/1 sur la notion de rémunération en fin de contrat : précise quelles indemnités sont soumises aux cotisations (indemnité de rupture standard) et lesquelles sont exclues (indemnité de protection femme enceinte, délégué syndical, conseiller en prévention). Référence pour la base de calcul de la cotisation spéciale.",
    url: "https://www.socialsecurity.be/employer/instructions/dmfa/fr/latest/instructions/salary/particularcases/end_of_contract.html",
    category: "onss",
    year: 2026,
    order: 30,
  },
  {
    label: "Moniteur belge — Loi du 3 juillet 1978 sur les contrats de travail",
    description:
      "Texte de référence pour le calcul de l'indemnité de rupture : article 39 (rupture sans préavis = indemnité égale à la rémunération courante de la période de préavis non prestée) et articles suivants. Régime unifié (CCT 109) depuis le 1ᵉʳ janvier 2014.",
    url: "https://www.ejustice.just.fgov.be",
    category: "moniteur",
    year: 2026,
    order: 40,
  },
  {
    label: "Moniteur belge — Loi du 26 décembre 2013 (cotisation spéciale)",
    description:
      "Loi instaurant la cotisation spéciale de compensation employeur sur les indemnités de rupture, à compter des prestations effectuées dès le 1ᵉʳ janvier 2014. Cadre juridique de la cotisation 1 / 2 / 3 % gérée par l'ONSS via le Fonds de fermeture.",
    url: "https://www.ejustice.just.fgov.be",
    category: "moniteur",
    year: 2026,
    order: 50,
  },
  {
    label: "SPF Emploi — Fin du contrat de travail",
    description:
      "Portail officiel SPF Emploi sur la fin du contrat de travail : préavis, indemnité compensatoire, protection contre le licenciement (femme enceinte, délégué syndical, conseiller en prévention). Page de référence pour les statuts protégés et leurs montants forfaitaires.",
    url: "https://emploi.belgique.be/fr/themes/contrats-de-travail/fin-du-contrat-de-travail",
    category: "spf-emploi",
    year: 2026,
    order: 60,
  },
];

async function main() {
  console.log(`Seed assets pour ${SLUG}…`);

  // Nettoyage des entrées URL précédentes (idempotence). On ne supprime PAS
  // les PDFs uploadés par l'admin (kind="pdf") pour ne pas perdre son travail.
  const deleted = await prisma.calculatorAsset.deleteMany({
    where: { slug: SLUG, kind: "url" },
  });
  console.log(`   ${deleted.count} entrée(s) URL supprimée(s) (idempotence)`);

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
    console.log(`   ${a.label}`);
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
