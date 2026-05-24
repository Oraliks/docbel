/**
 * Compare notre calc Brut/Net avec les références CSC.
 *
 * 7 cas de référence (CSC, version 1 janvier 2026 - capturés le 24/05/2026)
 * Tous : employé, secteur privé, temps plein 38/38, né le 01/01/1990.
 */

import { calcBrutNet } from "../lib/calculators/brut-net";

type Statut = "isole" | "marie_un_revenu";

const cases: Array<{
  label: string;
  refNet: number;
  refOnss: number;
  refImposable: number;
  refPrecompte: number;
  refCSSS: number;
  input: {
    brut: number;
    statut: Statut;
    enfants: number;
    region: "bruxelles";
    chequesRepas: boolean;
  };
}> = [
  {
    label: "2000 isolé 0 enfant",
    refNet: 1960.74,
    refOnss: 0.00,
    refImposable: 2000.00,
    refPrecompte: 36.97,
    refCSSS: 2.29,
    input: { brut: 2000, statut: "isole", enfants: 0, region: "bruxelles", chequesRepas: false },
  },
  {
    label: "2500 isolé 0 enfant",
    refNet: 2143.94,
    refOnss: 99.08,
    refImposable: 2400.92,
    refPrecompte: 243.24,
    refCSSS: 13.74,
    input: { brut: 2500, statut: "isole", enfants: 0, region: "bruxelles", chequesRepas: false },
  },
  {
    label: "3000 isolé 0 enfant",
    refNet: 2244.83,
    refOnss: 299.83,
    refImposable: 2700.17,
    refPrecompte: 436.10,
    refCSSS: 19.24,
    input: { brut: 3000, statut: "isole", enfants: 0, region: "bruxelles", chequesRepas: false },
  },
  {
    label: "3000 isolé 2 enfants",
    refNet: 2434.83,
    refOnss: 299.83,
    refImposable: 2700.17,
    refPrecompte: 246.10,
    refCSSS: 19.24,
    input: { brut: 3000, statut: "isole", enfants: 2, region: "bruxelles", chequesRepas: false },
  },
  {
    label: "3000 marié 1 revenu 0 enfant",
    refNet: 2595.38,
    refOnss: 299.83,
    refImposable: 2700.17,
    refPrecompte: 81.44,
    refCSSS: 23.35,
    input: { brut: 3000, statut: "marie_un_revenu", enfants: 0, region: "bruxelles", chequesRepas: false },
  },
  {
    label: "4000 isolé 0 enfant",
    refNet: 2614.22,
    refOnss: 522.80,
    refImposable: 3477.20,
    refPrecompte: 826.69,
    refCSSS: 36.29,
    input: { brut: 4000, statut: "isole", enfants: 0, region: "bruxelles", chequesRepas: false },
  },
  {
    label: "5000 isolé 0 enfant",
    refNet: 3051.73,
    refOnss: 653.50,
    refImposable: 4346.50,
    refPrecompte: 1245.26,
    refCSSS: 49.51,
    input: { brut: 5000, statut: "isole", enfants: 0, region: "bruxelles", chequesRepas: false },
  },
];

let maxEcart = 0;
let totalEcart = 0;
let countPass = 0;

for (const c of cases) {
  const res = calcBrutNet(c.input);
  console.log(`\n=== ${c.label} ===`);
  console.log(`Référence CSC      : ONSS ${c.refOnss.toFixed(2)} | Impos ${c.refImposable.toFixed(2)} | Précompte ${c.refPrecompte.toFixed(2)} | CSSS ${c.refCSSS.toFixed(2)} | NET ${c.refNet.toFixed(2)}`);
  if ("error" in res) {
    console.log(`Notre code : ERROR — ${res.error}`);
    continue;
  }
  console.log(`Notre code         : ONSS ${res.onssRetenue.toFixed(2)} | Impos ${res.imposable.toFixed(2)} | Précompte ${res.precompte.toFixed(2)} | CSSS ${res.cotisationSpeciale.toFixed(2)} | NET ${res.net.toFixed(2)}`);
  console.log(`  Workbonus interne: ${res.bonus.toFixed(2)} € (réduit ONSS de 13,07 % à ${res.onssRetenue.toFixed(2)})`);

  const ecart = res.net - c.refNet;
  const absEcart = Math.abs(ecart);
  totalEcart += absEcart;
  if (absEcart > maxEcart) maxEcart = absEcart;
  if (absEcart < 5) countPass++;

  const tag = absEcart < 5 ? "OK " : absEcart < 10 ? "WARN" : "FAIL";
  console.log(`  Écart NET vs CSC : ${ecart >= 0 ? "+" : ""}${ecart.toFixed(2)} € (${(ecart / c.refNet * 100).toFixed(2)} %) ${tag}`);
}

console.log(`\n────────────────────────────────────────`);
console.log(`Résumé : ${countPass}/${cases.length} cas avec écart < 5 €`);
console.log(`Écart maximum : ${maxEcart.toFixed(2)} €`);
console.log(`Écart moyen   : ${(totalEcart / cases.length).toFixed(2)} €`);
