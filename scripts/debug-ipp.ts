/**
 * Debug du calcul Impôt des Personnes Physiques (IPP) — EI 2026 (revenus 2025).
 *
 * 6 cas de référence pour valider la cohérence du calc contre le barème
 * fédéral publié par le SPF Finances et Tax-on-web.
 *
 * - C1 : Isolé 30 000 €, 0 enfants, additionnel 7 %
 * - C2 : Isolé 50 000 €, 2 enfants, additionnel 8 %
 * - C3 : Marié 1 revenu 45 000 €, 1 enfant
 * - C4 : Marié 2 revenus 65 000 € (cumulé), 3 enfants
 * - C5 : Réductions (épargne pension 1 050 + dons 200 + titres-services 1 500)
 * - C6 : Haut revenu 120 000 €, 0 enfants (tranche 50 %)
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/debug-ipp.ts
 *         (l'env n'est pas requis, c'est juste pour cohérence avec les autres scripts)
 */

import {
  calcIPP,
  type IPPInput,
  TRANCHES_IPP_2026,
  QUOTITE_BASE_2026,
  SUPPLEMENT_ENFANTS,
  SUPPLEMENT_AUTRE_PERSONNE,
  EPARGNE_PENSION_PLAFOND,
  EPARGNE_PENSION_TAUX,
  TITRES_SERVICES_PLAFOND,
  TITRES_SERVICES_TAUX,
  DONS_TAUX,
  QUOTIENT_CONJUGAL_PLAFOND,
  CSS_PLAFOND_ANNUEL,
} from "../lib/calculators/ipp";

type Cas = {
  label: string;
  input: IPPInput;
};

const cases: Cas[] = [
  {
    label:
      "C1 - Isolé 30 000 €, 0 enfants, additionnel 7 %",
    input: {
      revenuAnnuelImposable: 30000,
      statut: "isole",
      enfants: 0,
      autresPersonnesACharge: 0,
      additionnelCommunal: 7,
    },
  },
  {
    label:
      "C2 - Isolé 50 000 €, 2 enfants, additionnel 8 %",
    input: {
      revenuAnnuelImposable: 50000,
      statut: "isole",
      enfants: 2,
      autresPersonnesACharge: 0,
      additionnelCommunal: 8,
    },
  },
  {
    label:
      "C3 - Marié 1 revenu 45 000 €, 1 enfant, additionnel 7,5 %",
    input: {
      revenuAnnuelImposable: 45000,
      statut: "marie_un_revenu",
      enfants: 1,
      autresPersonnesACharge: 0,
      additionnelCommunal: 7.5,
    },
  },
  {
    label:
      "C4 - Marié 2 revenus 65 000 € (cumulé), 3 enfants, additionnel 7,5 %",
    input: {
      revenuAnnuelImposable: 65000,
      statut: "marie_deux_revenus",
      enfants: 3,
      autresPersonnesACharge: 0,
      additionnelCommunal: 7.5,
    },
  },
  {
    label:
      "C5 - Isolé 40 000 €, 1 enfant, réductions (ép. pension 1050 + dons 200 + TS 1500)",
    input: {
      revenuAnnuelImposable: 40000,
      statut: "isole",
      enfants: 1,
      autresPersonnesACharge: 0,
      additionnelCommunal: 7,
      epargnePension: 1050,
      titresServices: 1500,
      dons: 200,
    },
  },
  {
    label:
      "C6 - Isolé haut revenu 120 000 €, 0 enfants, additionnel 7 % (tranche 50 %)",
    input: {
      revenuAnnuelImposable: 120000,
      statut: "isole",
      enfants: 0,
      autresPersonnesACharge: 0,
      additionnelCommunal: 7,
    },
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers d'affichage                                               */
/* ------------------------------------------------------------------ */

const fmtEUR = (n: number) =>
  n.toLocaleString("fr-BE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtPct = (n: number, digits = 2) =>
  `${n.toLocaleString("fr-BE", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} %`;

/* ------------------------------------------------------------------ */
/*  Synthèse des constantes                                           */
/* ------------------------------------------------------------------ */

console.log("================================================================");
console.log("  Validation IPP EI 2026 (revenus 2025) — barème SPF Finances");
console.log("================================================================");
console.log("Constantes utilisées :");
TRANCHES_IPP_2026.forEach((t, i) => {
  const bornes = `${t.min.toLocaleString("fr-BE")} → ${
    t.max === Infinity ? "∞" : t.max.toLocaleString("fr-BE")
  } €`;
  console.log(`  Tranche ${i + 1} : ${bornes.padEnd(28)} ${fmtPct(t.taux * 100, 0)}`);
});
console.log(`  Quotité exemptée base    : ${fmtEUR(QUOTITE_BASE_2026)} / an`);
console.log(
  `  Supplément 1er enfant    : ${fmtEUR(SUPPLEMENT_ENFANTS[1])} (cumulé)`,
);
console.log(
  `  Supplément 2 enfants     : ${fmtEUR(SUPPLEMENT_ENFANTS[2])} (cumulé)`,
);
console.log(
  `  Supplément 3 enfants     : ${fmtEUR(SUPPLEMENT_ENFANTS[3])} (cumulé)`,
);
console.log(
  `  Supplément 4 enfants     : ${fmtEUR(SUPPLEMENT_ENFANTS[4])} (cumulé)`,
);
console.log(
  `  Autre personne à charge  : ${fmtEUR(SUPPLEMENT_AUTRE_PERSONNE)} / personne`,
);
console.log(
  `  Quotient conjugal plafond: ${fmtEUR(QUOTIENT_CONJUGAL_PLAFOND)} (Art. 134 CIR 92)`,
);
console.log(
  `  Épargne pension          : ${fmtPct(
    EPARGNE_PENSION_TAUX * 100,
    0,
  )} × min(versement, ${fmtEUR(EPARGNE_PENSION_PLAFOND)})`,
);
console.log(
  `  Titres-services          : ${fmtPct(
    TITRES_SERVICES_TAUX * 100,
    0,
  )} × min(achats, ${fmtEUR(TITRES_SERVICES_PLAFOND)})`,
);
console.log(`  Dons (≥ 40 €)            : ${fmtPct(DONS_TAUX * 100, 0)} du montant`);
console.log(
  `  Cotisation spéciale max  : ${fmtEUR(CSS_PLAFOND_ANNUEL)} / an (loi 30/03/1994)`,
);

/* ------------------------------------------------------------------ */
/*  Boucle sur les 6 cas                                              */
/* ------------------------------------------------------------------ */

const summary: Array<{
  cas: string;
  revenu: number;
  brut: number;
  reductions: number;
  additionnel: number;
  total: number;
  net: number;
  tauxMoyen: number;
  tauxMarginal: number;
}> = [];

for (const c of cases) {
  console.log(`\n--- ${c.label} ---`);
  const res = calcIPP(c.input);
  if ("error" in res) {
    console.log(`ERREUR : ${res.error}`);
    continue;
  }

  console.log(`Revenu imposable        : ${fmtEUR(c.input.revenuAnnuelImposable)} / an`);
  console.log(`Statut                  : ${c.input.statut}`);
  console.log(
    `Personnes à charge      : ${c.input.enfants} enfant(s), ${c.input.autresPersonnesACharge} autre(s)`,
  );
  console.log(`Additionnel communal    : ${c.input.additionnelCommunal} %`);
  console.log(`Quotité exemptée totale : ${fmtEUR(res.quotiteExemptee)}`);
  console.log(`Réduction quotité       : ${fmtEUR(res.reductionQuotite)}`);
  if (res.allegementQuotientConjugal > 0) {
    console.log(
      `Allègement QC           : ${fmtEUR(res.allegementQuotientConjugal)} (marié 1 revenu)`,
    );
  }
  console.log(`Impôt fédéral brut      : ${fmtEUR(res.impotBrutFederal)}`);
  if (res.reductionsTotales > 0) {
    console.log(`Réductions d'impôt      : ${fmtEUR(res.reductionsTotales)}`);
  }
  console.log(`Impôt après crédits     : ${fmtEUR(res.impotBrutApresCredits)}`);
  console.log(`Additionnel communal €  : ${fmtEUR(res.additionnelCommunalEur)}`);
  if (res.cotisationSpecialeSecu > 0) {
    console.log(`Cotisation spéciale sécu: ${fmtEUR(res.cotisationSpecialeSecu)}`);
  }
  console.log(`---`);
  console.log(`Impôt TOTAL             : ${fmtEUR(res.impotTotal)} / an`);
  console.log(`Revenu NET après impôt  : ${fmtEUR(res.revenuNetApresImpot)} / an`);
  console.log(`Taux moyen              : ${fmtPct(res.tauxMoyen)}`);
  console.log(`Taux marginal           : ${fmtPct(res.tauxMarginal, 0)}`);

  summary.push({
    cas: c.label.split(" -")[0],
    revenu: c.input.revenuAnnuelImposable,
    brut: res.impotBrutFederal,
    reductions: res.reductionsTotales,
    additionnel: res.additionnelCommunalEur,
    total: res.impotTotal,
    net: res.revenuNetApresImpot,
    tauxMoyen: res.tauxMoyen,
    tauxMarginal: res.tauxMarginal,
  });
}

/* ------------------------------------------------------------------ */
/*  Tableau de synthèse                                               */
/* ------------------------------------------------------------------ */

console.log("\n================================================================");
console.log("  Synthèse comparée — 6 cas IPP EI 2026");
console.log("================================================================");
const head = [
  "Cas",
  "Revenu",
  "Imp.brut",
  "Réduc.",
  "Add.com",
  "TOTAL",
  "Net",
  "T.moy",
  "T.marg",
];
console.log(
  head
    .map((h, i) =>
      i === 0
        ? h.padEnd(4)
        : h.padStart(i === 6 ? 12 : 10),
    )
    .join(" │ "),
);
console.log("─".repeat(95));
for (const s of summary) {
  const cols = [
    s.cas.padEnd(4),
    s.revenu.toLocaleString("fr-BE").padStart(10),
    s.brut.toLocaleString("fr-BE", { maximumFractionDigits: 0 }).padStart(10),
    s.reductions
      .toLocaleString("fr-BE", { maximumFractionDigits: 0 })
      .padStart(10),
    s.additionnel
      .toLocaleString("fr-BE", { maximumFractionDigits: 0 })
      .padStart(10),
    s.total
      .toLocaleString("fr-BE", { maximumFractionDigits: 0 })
      .padStart(10),
    s.net.toLocaleString("fr-BE", { maximumFractionDigits: 0 }).padStart(12),
    `${s.tauxMoyen.toFixed(1)} %`.padStart(10),
    `${s.tauxMarginal.toFixed(0)} %`.padStart(10),
  ];
  console.log(cols.join(" │ "));
}

console.log(
  "\nNote : valeurs en €/an. Comparer à Tax-on-web (SPF Finances) pour validation finale.",
);
console.log("================================================================");
