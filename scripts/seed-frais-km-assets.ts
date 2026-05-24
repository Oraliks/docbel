/**
 * Seed initial des sources officielles pour le calculateur Frais kilométriques
 * domicile-travail.
 *
 * Ces URLs pointent vers les organismes officiels de l'État belge à consulter
 * pour la maintenance des barèmes :
 *   - SPF Finances (taux vélo annuel, forfait légal, page transport)
 *   - SPF Mobilité (politique vélo, primes)
 *   - BOSA (circulaires trimestrielles indemnité km fonctionnaires)
 *   - Moniteur belge (CIR 92 art. 49, 51, 66)
 *
 * Sources publiques EXCLUSIVEMENT officielles de l'État belge — aucune source
 * privée (syndicats, secrétariats sociaux, sites comptables), conformément à
 * la directive Docbel.
 *
 * Idempotent : suppression préalable des entrées URL existantes pour ce slug ;
 * conserve les PDFs uploadés par l'admin (kind="pdf").
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-frais-km-assets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "frais-kilometriques";

const ASSETS = [
  {
    label: "SPF Finances — Indemnités frais déplacement domicile-travail",
    description:
      "Page hub du Service Public Fédéral Finances détaillant les régimes fiscaux applicables aux indemnités de déplacement domicile-lieu de travail pour les revenus 2026 / exercice d'imposition 2027 : vélo (0,37 €/km, plafond 3 700 €/an), voiture personnelle (exonération forfaitaire 500 €), transports publics (100 %), codes Tax-on-web 1254/2254 (revenus) et 1255/2255 (exonération). Référence officielle annuelle.",
    url: "https://fin.belgium.be/fr/particuliers/declaration-impot/revenus/indemnites-frais-deplacement-domicile-lieu-travail",
    category: "spf-finances",
    year: 2026,
    order: 10,
  },
  {
    label: "SPF Finances — Forfait et frais réels (page officielle)",
    description:
      "Page SPF Finances expliquant l'option entre le forfait légal des frais professionnels (CIR 92 art. 51, plafonné à 6 070 €/an en 2026) et les frais réels. Indique les conditions de déduction kilométrique et les justificatifs requis. À consulter chaque janvier pour le plafond indexé.",
    url: "https://fin.belgium.be/fr/particuliers/transport/deduction_frais_de_transport/trajet_domicile_travail/forfait_et_frais_reels",
    category: "spf-finances",
    year: 2026,
    order: 20,
  },
  {
    label: "SPF Mobilité — Avantages fiscaux et primes vélo",
    description:
      "Page hub du SPF Mobilité (mobilit.belgium.be) sur les avantages fiscaux liés au vélo en Belgique : indemnité kilométrique vélo, plafond annuel d'exonération (3 700 €/an en revenus 2026), condition de plafond 20 km par trajet simple. Politique publique de mobilité durable. Indexation annuelle.",
    url: "https://mobilit.belgium.be/fr/mobilite-durable/velos/avantages-fiscaux-et-primes-velo",
    category: "spf-mobilite",
    year: 2026,
    order: 30,
  },
  {
    label: "BOSA — Indemnité kilométrique fonctionnaires (page officielle)",
    description:
      "Page hub du Service Public Fédéral Stratégie et Appui (BOSA) listant les circulaires trimestrielles fixant le tarif de l'indemnité kilométrique applicable aux fonctionnaires fédéraux et utilisable comme tarif de référence pour la déduction des frais réels domicile-travail voiture. Q2 2026 (01/04 – 30/06) = 0,4327 €/km (circulaire n° 764). À surveiller chaque trimestre.",
    url: "https://bosa.belgium.be/fr/themes/travailler-dans-la-fonction-publique/remuneration-et-avantages/allocations-et-indemnites-13",
    category: "bosa",
    year: 2026,
    order: 40,
  },
  {
    label: "Moniteur belge — CIR 92 (Code des impôts sur les revenus)",
    description:
      "Texte de référence : Code des impôts sur les revenus 1992. Articles centraux pour ce calcul : art. 49 (frais professionnels déductibles), art. 51 (forfait légal des frais professionnels — plafond 6 070 € revenus 2026), art. 66 (déduction forfaitaire kilométrique = 0,15 €/km, non cumulable avec l'indemnité employeur). Consultable via le portail de législation justel.fgov.be.",
    url: "https://www.ejustice.just.fgov.be",
    category: "moniteur",
    year: 1992,
    order: 50,
  },
  {
    label: "SPF Finances — Tax-on-web (MyMinfin, déclaration en ligne)",
    description:
      "Portail officiel de déclaration fiscale belge. Les indemnités domicile-travail reçues se déclarent en cases 1254/2254 (montants reçus) et 1255/2255 (exonération demandée). Les frais réels se détaillent dans la partie 2 de la déclaration. Lien public d'aide vers la déclaration en ligne.",
    url: "https://finances.belgium.be/fr/E-services/tax-on-web",
    category: "tax-on-web",
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
