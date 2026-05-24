/**
 * Seed initial des sources officielles pour le calculateur Pension légale
 * (salarié).
 *
 * Ces URLs pointent vers les organismes publics belges de référence pour
 * la maintenance annuelle des barèmes (plafond salarial, minimum garanti,
 * conditions d'anticipation). L'admin peut ensuite ajouter ses propres
 * PDFs uploadés via /admin/chomage/outils/calculateurs/pension-estimation.
 *
 * Sources publiques EXCLUSIVEMENT officielles de l'État belge — aucun
 * simulateur privé ni concurrent, conformément à la directive Docbel.
 *
 * Idempotent : upsert sur (slug + url) via une suppression préalable
 * des entrées URL existantes pour ce slug.
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-pension-assets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "pension-estimation";

const ASSETS = [
  {
    label: "SFP — Calcul de la pension salarié",
    description:
      "Page officielle du Service Fédéral des Pensions détaillant la formule de calcul (taux × carrière / 45), les taux isolé (60 %) et ménage (75 %), et la notion de salaire forfaitaire ou réel pris en compte. Référence pour comprendre la base de la formule.",
    url: "https://www.sfpd.fgov.be/fr/montant-de-la-pension/calcul/types-de-pensions/salaries",
    category: "sfp",
    year: 2026,
    order: 10,
  },
  {
    label: "SFP — Plafonds salariaux annuels",
    description:
      "Plafond salarial annuel pris en compte pour le calcul de la pension salarié. Au-delà de ce plafond, le salaire n'augmente plus la pension. Indexé annuellement — page à consulter chaque année après l'indexation.",
    url: "https://www.sfpd.fgov.be/fr/montant-de-la-pension/calcul/types-de-pensions/salaries/salaires/plafond-salarial/",
    category: "sfp",
    year: 2026,
    order: 20,
  },
  {
    label: "SFP — Pension minimum garantie",
    description:
      "Page officielle SFP sur le plancher minimum garanti (isolé / ménage), les conditions de carrière minimum (30 ans), les jours équivalents temps plein requis depuis 2025 et la règle de proratisation sur 45 ans.",
    url: "https://www.sfpd.fgov.be/fr/montant-de-la-pension/calcul/minimum-garanti-de-pension/",
    category: "sfp",
    year: 2026,
    order: 30,
  },
  {
    label: "mypension.be — Compte de carrière personnel",
    description:
      "Portail officiel commun SFP / INASTI / SdPSP. Permet à chaque citoyen belge de consulter son compte de carrière complet (login itsme) et d'obtenir une estimation personnalisée et juridiquement opposable de sa pension future.",
    url: "https://www.mypension.be",
    category: "mypension",
    year: 2026,
    order: 40,
  },
  {
    label: "Moniteur belge — Loi du 10 août 2015 (âge légal + anticipation)",
    description:
      "Loi relevant l'âge légal de la pension à 66 ans (2025) puis 67 ans (2030) et durcissant les conditions de pension anticipée (carrière minimum par âge : 44 ans à 60 ans, 43 ans à 61 ans, 42 ans entre 62 et 64 ans). Cadre juridique central du calc.",
    url: "https://www.ejustice.just.fgov.be",
    category: "moniteur",
    year: 2026,
    order: 50,
  },
  {
    label: "Moniteur belge — AR 21 décembre 1967 (régime général salariés)",
    description:
      "Arrêté royal portant règlement général du régime de pension de retraite et de survie des travailleurs salariés. Texte de référence pour les taux (60 % / 75 %), la carrière complète conventionnelle de 45 ans et le mécanisme de plafonnement.",
    url: "https://www.ejustice.just.fgov.be",
    category: "moniteur",
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
