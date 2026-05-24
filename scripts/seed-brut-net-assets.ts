/**
 * Seed initial des sources officielles pour le calculateur Brut/Net.
 *
 * Ces URLs pointent vers les pages officielles à consulter pour la
 * maintenance annuelle des barèmes. L'admin peut ensuite ajouter ses
 * propres PDFs uploadés via /admin/chomage/outils/calculateurs/brut-net.
 *
 * Idempotent : upsert sur (slug + url) via une suppression préalable
 * des entrées URL existantes pour ce slug.
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/seed-brut-net-assets.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "brut-net";

const ASSETS = [
  {
    label: "Barème précompte professionnel mensuel 2026 (Annexe III AR/CIR 92)",
    description:
      "Le barème officiel SPF Finances. Publié chaque année (mi-décembre), applicable au 1ᵉʳ janvier. Indispensable pour le calibrage du précompte mensuel.",
    url: "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/precompte_professionnel/calcul",
    category: "precompte",
    year: 2026,
    order: 10,
  },
  {
    label: "Workbonus — Volet A + Volet B (1ᵉʳ avril 2026)",
    description:
      "Barème Securex consolidé du bonus à l'emploi. Indexé 2 fois par an (1ᵉʳ janvier et 1ᵉʳ avril). Source utilisée pour `calcWorkbonus()`.",
    url: "https://www.securex.be/fr/lex4you/employeur/montants-actuels/montants-socio-juridiques/bonus-a-l-emploi",
    category: "workbonus",
    year: 2026,
    order: 20,
  },
  {
    label: "Cotisation spéciale sécurité sociale (CSSS) 2026",
    description:
      "Barème mensuel par tranches de revenu annuel. Loi du 28 décembre 1992, indexé annuellement. Source utilisée pour `calcCSSS()`.",
    url: "https://www.securex.be/fr/lex4you/employeur/montants-actuels/montants-socio-juridiques/cotisation-speciale-pour-la-securite-sociale",
    category: "css",
    year: 2026,
    order: 30,
  },
  {
    label: "ONSS travailleur — taux 13,07 %",
    description:
      "Taux inchangé depuis 1981 (loi du 27 juin 1969). Page officielle ONSS pour vérifier qu'il n'a pas évolué.",
    url: "https://www.socialsecurity.be",
    category: "general",
    year: 2026,
    order: 40,
  },
  {
    label: "Avantage de toute nature voiture (ATN) — AR 14/01/2014 indexé 2026",
    description:
      "Formule de calcul : valeur catalogue × 6/7 × coef CO2 × décote vétusté. Minimum légal 1 660 €/an en 2026.",
    url: "https://finances.belgium.be/fr/entreprises/personnel_et_remuneration/voitures_de_societe",
    category: "atn",
    year: 2026,
    order: 50,
  },
  {
    label: "Indemnité télétravail forfaitaire — Circulaire 2021/C/20",
    description:
      "Plafond mensuel 154,74 € (2026), non imposable et non soumis à l'ONSS.",
    url: "https://finances.belgium.be",
    category: "general",
    year: 2026,
    order: 60,
  },
  {
    label: "CSC — Simulateur Brut-Net (référence de calibrage)",
    description:
      "Outil officiel CSC utilisé comme source de vérité pour le calibrage de notre calc. Version 1ᵉʳ janvier 2026. À ré-tester chaque janvier pour valider notre code (cf. scripts/debug-brut-net.ts).",
    url: "https://tools.lacsc.be/trefzeker-tools/acv/brutonetto-light?lang=fr",
    category: "general",
    year: 2026,
    order: 70,
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
