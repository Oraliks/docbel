/**
 * Debug du calcul Indemnité de rupture (préavis non presté) 2026.
 *
 * 6 cas de référence pour valider la cohérence du calc contre :
 *   - Loi du 3 juillet 1978 (art. 39) — formule hebdo = mensuelle × 3 / 13
 *   - SPF Finances — barème précompte spécial 2026 (5 tranches)
 *   - ONSS 2026/1 — cotisation spéciale progressive 1 / 2 / 3 %
 *   - Loi du 16 mars 1971 (femme enceinte, 6 mois)
 *   - CCT n° 5 (délégué syndical, 36 mois centrale)
 *   - Loi du 19 mars 1991 (conseiller prévention, 9 mois médiane)
 *
 * Cas testés :
 *   C1 — Employé 3 500 €/mois, 12 sem, sans avantages, brut+net.
 *   C2 — Cadre 6 000 €/mois, 26 sem, avantages 5 000 €/an.
 *   C3 — Ouvrier 2 500 €/mois, 8 sem, sans précompte (brut seul).
 *   C4 — Délégué syndical (CCT 5, +36 mois) — protection cumulée.
 *   C5 — Femme enceinte (loi 1971, +6 mois) — protection cumulée.
 *   C6 — Haut revenu 8 500 €/mois, 52 sem — déclenche cot. 3 %.
 *
 * Usage : pnpm dotenv -e .env.local -- tsx scripts/debug-indemnite-rupture.ts
 */

import {
  calcIndemniteRupture,
  COEF_ANNUALISATION,
  PROTECTION_MOIS,
  TRANCHES_COTISATION_SPECIALE,
  BAREME_PRECOMPTE_SPECIAL,
  type IndemniteInput,
  type IndemniteResult,
} from "../lib/calculators/indemnite-rupture";

interface Cas {
  label: string;
  input: IndemniteInput;
  expected?: string;
}

const cases: Cas[] = [
  {
    label:
      "C1 — Employé 3 500 €/mois, 12 sem, sans avantages, brut+net",
    input: {
      salaireBrutMensuel: 3500,
      dureePreavisSemaines: 12,
      avantagesAnnuels: 0,
      inclureAvantages: false,
      precompte: true,
      protectionSpeciale: "aucune",
    },
    expected:
      "Brut annuel ~ 48 720 € → précompte tranche 4 (41,80 %), cotisation tranche 0 (sous 50 166 €).",
  },
  {
    label:
      "C2 — Cadre 6 000 €/mois, 26 sem, avantages 5 000 €/an, brut+net",
    input: {
      salaireBrutMensuel: 6000,
      dureePreavisSemaines: 26,
      avantagesAnnuels: 5000,
      inclureAvantages: true,
      precompte: true,
      protectionSpeciale: "aucune",
    },
    expected:
      "Brut annuel ~ 83 520 € → précompte tranche 5 (53,50 %), cotisation tranche 3 (3 %).",
  },
  {
    label:
      "C3 — Ouvrier 2 500 €/mois, 8 sem, sans précompte (brut seul)",
    input: {
      salaireBrutMensuel: 2500,
      dureePreavisSemaines: 8,
      avantagesAnnuels: 0,
      inclureAvantages: false,
      precompte: false,
      protectionSpeciale: "aucune",
    },
    expected:
      "Brut annuel ~ 34 800 € → précompte tranche 4 (41,80 %) mais non appliqué, cotisation 0 (sous seuil).",
  },
  {
    label:
      "C4 — Délégué syndical, 4 500 €/mois, 13 sem + protection CCT 5 (+36 mois)",
    input: {
      salaireBrutMensuel: 4500,
      dureePreavisSemaines: 13,
      avantagesAnnuels: 0,
      inclureAvantages: false,
      precompte: true,
      protectionSpeciale: "delegue_syndical",
    },
    expected:
      "Indemnité standard ~ 13 500 € + protection 162 000 € (36 × 4 500). Cotisation 1 % uniquement sur indemnité standard (62 640 € > 61 437 €, donc 2 %).",
  },
  {
    label:
      "C5 — Femme enceinte, 3 200 €/mois, 10 sem + protection loi 1971 (+6 mois)",
    input: {
      salaireBrutMensuel: 3200,
      dureePreavisSemaines: 10,
      avantagesAnnuels: 0,
      inclureAvantages: false,
      precompte: true,
      protectionSpeciale: "femme_enceinte",
    },
    expected:
      "Indemnité standard ~ 7 385 € + protection 19 200 € (6 × 3 200). Brut annuel ~ 44 544 € → précompte tranche 4 (41,80 %), pas de cotisation (sous 50 166 €).",
  },
  {
    label:
      "C6 — Haut revenu 8 500 €/mois, 52 sem, brut+net — déclenche cot. 3 %",
    input: {
      salaireBrutMensuel: 8500,
      dureePreavisSemaines: 52,
      avantagesAnnuels: 0,
      inclureAvantages: false,
      precompte: true,
      protectionSpeciale: "aucune",
    },
    expected:
      "Brut annuel 118 320 € → précompte tranche 5 (53,50 %), cotisation tranche 3 (3 %).",
  },
];

const fmt = (n: number) =>
  n.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtPct = (n: number) =>
  `${n.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} %`;

console.log("==============================================================");
console.log("  Validation Indemnité de rupture 2026 — Loi 03/07/1978");
console.log("==============================================================");
console.log("Constantes utilisées :");
console.log(`  - Coefficient annualisation : × ${COEF_ANNUALISATION}`);
console.log(
  `  - Précompte spécial : ${BAREME_PRECOMPTE_SPECIAL.map((t) => fmtPct(t.taux * 100)).join(" / ")}`,
);
console.log(
  `  - Tranches précompte (€)   : ≤ ${BAREME_PRECOMPTE_SPECIAL.slice(0, -1)
    .map((t) => t.jusqua.toLocaleString("fr-BE"))
    .join(" / ≤ ")} / au-delà`,
);
console.log(
  `  - Cotisation spéciale (%)  : ${TRANCHES_COTISATION_SPECIALE.map((t) => fmtPct(t.taux * 100)).join(" / ")}`,
);
console.log(
  `  - Seuils cotisation (€)    : ≥ ${TRANCHES_COTISATION_SPECIALE.map((t) => t.seuil.toLocaleString("fr-BE")).join(" / ≥ ")}`,
);
console.log(`  - Protection mois          : aucune ${PROTECTION_MOIS.aucune} · enceinte ${PROTECTION_MOIS.femme_enceinte} · syndical ${PROTECTION_MOIS.delegue_syndical} · CPPT ${PROTECTION_MOIS.travailleur_protege}`);

// --- Tableau récapitulatif tabulaire ---
console.log("\n--- Tableau récapitulatif ---");
const header = [
  "Cas",
  "Brut mensuel",
  "Préavis",
  "Indemnité brute",
  "+ Protection",
  "Total brut",
  "Précompte %",
  "Net estimé",
  "Cot. employeur",
];
console.log(header.join(" | "));
console.log(header.map(() => "---").join(" | "));

for (const c of cases) {
  const res = calcIndemniteRupture(c.input);
  if ("error" in res) {
    console.log(`${c.label} | ERREUR : ${res.error}`);
    continue;
  }
  const id = c.label.split("—")[0].trim();
  const row = [
    id,
    fmt(c.input.salaireBrutMensuel) + " €",
    `${c.input.dureePreavisSemaines} sem.`,
    fmt(res.indemniteBrute) + " €",
    res.indemniteProtectionSupplement > 0
      ? fmt(res.indemniteProtectionSupplement) + " €"
      : "—",
    fmt(res.indemniteTotalBrute) + " €",
    c.input.precompte ? fmtPct(res.tauxPrecompteAppliquePourcent) : "—",
    c.input.precompte ? fmt(res.indemniteNetEstimee) + " €" : "—",
    res.cotisationSpecialeEmployeur > 0
      ? `${fmt(res.cotisationSpecialeEmployeur)} € (${res.tauxCotisationSpecialePourcent} %)`
      : "0 €",
  ];
  console.log(row.join(" | "));
}

// --- Détail par cas ---
for (const c of cases) {
  console.log(`\n=== ${c.label} ===`);
  if (c.expected) console.log(`  Expected : ${c.expected}`);
  const res = calcIndemniteRupture(c.input);
  if ("error" in res) {
    console.log(`ERREUR : ${res.error}`);
    continue;
  }
  printCase(c.input, res);
}

console.log("\n==============================================================");
console.log("  Résumé : 6 cas testés — comparer aux fiches SPF Finances + ONSS");
console.log("==============================================================");

function printCase(input: IndemniteInput, res: IndemniteResult): void {
  console.log(
    `  Salaire brut mensuel        : ${fmt(input.salaireBrutMensuel)} €`,
  );
  console.log(
    `  Avantages annuels mensualis.: ${input.inclureAvantages && input.avantagesAnnuels > 0 ? `${fmt(input.avantagesAnnuels)} €/an (+ ${fmt(input.avantagesAnnuels / 12)} €/mois)` : "—"}`,
  );
  console.log(`  Brut annuel de référence    : ${fmt(res.brutAnnuelReference)} €`);
  console.log(
    `  Rémunération mensuelle base : ${fmt(res.remunerationMensuelle)} €`,
  );
  console.log(
    `  Rémunération hebdomadaire   : ${fmt(res.remunerationHebdomadaire)} €`,
  );
  console.log(`  Préavis non presté          : ${res.preavisSemaines} semaines`);
  console.log(`  Indemnité standard (hebdo × sem) : ${fmt(res.indemniteBrute)} €`);
  if (res.indemniteProtectionSupplement > 0) {
    const moisProt = PROTECTION_MOIS[res.protectionSpeciale];
    console.log(
      `  Indemnité de protection     : ${fmt(res.indemniteProtectionSupplement)} € (${res.protectionSpeciale}, ${moisProt} mois)`,
    );
  }
  console.log(`  Total brut                  : ${fmt(res.indemniteTotalBrute)} €`);
  if (input.precompte) {
    console.log(
      `  Précompte spécial appliqué  : ${fmtPct(res.tauxPrecompteAppliquePourcent)}`,
    );
    console.log(`  Net estimé                  : ${fmt(res.indemniteNetEstimee)} €`);
  } else {
    console.log(`  Précompte non calculé       : —`);
  }
  if (res.cotisationSpecialeEmployeur > 0) {
    console.log(
      `  Cotisation spéciale ONSS    : ${fmt(res.cotisationSpecialeEmployeur)} € (${fmtPct(res.tauxCotisationSpecialePourcent)}, à charge de l'employeur)`,
    );
  } else {
    console.log(
      `  Cotisation spéciale ONSS    : 0 € (sous seuil 50 166 €/an)`,
    );
  }
}
