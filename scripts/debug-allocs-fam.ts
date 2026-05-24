/**
 * Debug du calcul Allocations familiales 2026 — 4 régimes régionaux.
 *
 * 6 cas de référence pour valider la cohérence du calc contre les
 * simulateurs officiels (FAMIWAL, FAMIRIS, Groeipakket, Kindergeld DG).
 *
 * Tous les cas sont en 2026.
 */

import { calcAllocsFam, type AllocsFamInput } from "../lib/calculators/allocs-fam";

type Cas = {
  label: string;
  input: AllocsFamInput;
};

const cases: Cas[] = [
  {
    label: "C1 — Wallonie · 2 enfants (2018, 2020) · revenu 50 000 €/an · non mono",
    input: {
      region: "wallonie",
      enfants: [
        { anneeNaissance: 2018 },
        { anneeNaissance: 2020 },
      ],
      revenuMenageAnnuel: 50_000,
      monoparental: false,
    },
  },
  {
    label: "C2 — Wallonie · 1 enfant (2020) · revenu 30 000 € (bas) · MONOPARENTAL",
    input: {
      region: "wallonie",
      enfants: [{ anneeNaissance: 2020 }],
      revenuMenageAnnuel: 30_000,
      monoparental: true,
    },
  },
  {
    label:
      "C3 — Bruxelles · 2 enfants (2017, 2021) · revenu 50 000 € (intermédiaire) · non mono",
    input: {
      region: "bruxelles",
      enfants: [
        { anneeNaissance: 2017 },
        { anneeNaissance: 2021 },
      ],
      revenuMenageAnnuel: 50_000,
      monoparental: false,
    },
  },
  {
    label:
      "C3bis — Bruxelles · 3 enfants (2014, 2018, 2022) · revenu 30 000 € (bas) · MONO",
    input: {
      region: "bruxelles",
      enfants: [
        { anneeNaissance: 2014 },
        { anneeNaissance: 2018 },
        { anneeNaissance: 2022 },
      ],
      revenuMenageAnnuel: 30_000,
      monoparental: true,
    },
  },
  {
    label: "C4 — Flandre · 3 enfants (2015, 2019, 2023) · revenu 28 000 € (bas)",
    input: {
      region: "flandre",
      enfants: [
        { anneeNaissance: 2015 },
        { anneeNaissance: 2019 },
        { anneeNaissance: 2023 },
      ],
      revenuMenageAnnuel: 28_000,
      monoparental: false,
    },
  },
  {
    label: "C5 — Wallonie · 1 enfant HANDICAPÉ (2019) · revenu 45 000 € · non mono",
    input: {
      region: "wallonie",
      enfants: [{ anneeNaissance: 2019, handicap: true }],
      revenuMenageAnnuel: 45_000,
      monoparental: false,
    },
  },
  {
    label: "C6 — Wallonie · 1 enfant ORPHELIN un parent (2018) · revenu 40 000 € · non mono",
    input: {
      region: "wallonie",
      enfants: [{ anneeNaissance: 2018, orphelin: "un_parent" }],
      revenuMenageAnnuel: 40_000,
      monoparental: false,
    },
  },
  {
    label: "C7 — Flandre · 1 enfant ORPHELIN un parent (2019) · revenu 50 000 € · non mono",
    input: {
      region: "flandre",
      enfants: [{ anneeNaissance: 2019, orphelin: "un_parent" }],
      revenuMenageAnnuel: 50_000,
      monoparental: false,
    },
  },
  {
    label: "C8 — Germanophone · 3 enfants (2017, 2020, 2024) · revenu 28 000 € (bas) · non mono",
    input: {
      region: "germanophone",
      enfants: [
        { anneeNaissance: 2017 },
        { anneeNaissance: 2020 },
        { anneeNaissance: 2024 },
      ],
      revenuMenageAnnuel: 28_000,
      monoparental: false,
    },
  },
  {
    label: "C9 — Germanophone · 1 enfant né en 2026 · revenu 50 000 € · non mono (test Geburtsprämie)",
    input: {
      region: "germanophone",
      enfants: [{ anneeNaissance: 2026 }],
      revenuMenageAnnuel: 50_000,
      monoparental: false,
    },
  },
];

const fmt = (n: number) =>
  n.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

console.log("==============================================================");
console.log("  Validation Allocations familiales 2026 — FAMIWAL/FAMIRIS/");
console.log("  Groeipakket/Kindergeld DG");
console.log("==============================================================");

for (const c of cases) {
  console.log(`\n--- ${c.label} ---`);
  const res = calcAllocsFam(c.input);
  if ("error" in res) {
    console.log(`ERREUR : ${res.error}`);
    continue;
  }

  console.log(`Régime           : ${res.regionLabel}`);
  console.log(`TOTAL MENSUEL    : ${fmt(res.totalMensuel)} €`);
  console.log(`Bonus rentrée    : ${fmt(res.bonusRentreeAnnuel)} €/an`);
  console.log(`Allocation naiss.: ${fmt(res.allocationNaissanceTotale)} € (one-shot)`);

  console.log("Détail par enfant :");
  for (const d of res.detail) {
    const supps: string[] = [];
    if (d.supplementHandicap) supps.push(`handicap +${fmt(d.supplementHandicap)}`);
    if (d.supplementOrphelin) supps.push(`orphelin +${fmt(d.supplementOrphelin)}`);
    if (d.supplement3eEnfant) supps.push(`3e BXL +${fmt(d.supplement3eEnfant)}`);
    const reste = d.supplements
      - (d.supplementHandicap ?? 0)
      - (d.supplementOrphelin ?? 0)
      - (d.supplement3eEnfant ?? 0);
    if (reste > 0.001) supps.push(`social/mono +${fmt(reste)}`);
    console.log(
      `  - rang ${d.rang} (${d.age} an${d.age > 1 ? "s" : ""}) : base ${fmt(d.montantBase)} € + supp ${fmt(d.supplements)} € = ${fmt(d.total)} €` +
      (supps.length ? `   [${supps.join(", ")}]` : ""),
    );
  }
}

console.log("\n==============================================================");
console.log("  Résumé : 6 cas testés — voir tableau de comparaison externe");
console.log("==============================================================");
