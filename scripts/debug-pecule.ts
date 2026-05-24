/**
 * Debug du calcul Pécule de vacances 2026.
 *
 * 6 cas de référence pour valider la cohérence du calc contre des
 * simulateurs publics (ONVA officiel, simulateurs RH professionnels).
 *
 * Tous les cas sont en 2026, mois prestés N-1 = 2025.
 */

import {
  calcPecule,
  PRECOMPTE_PECULE_SIMPLE_EMPLOYE,
  PRECOMPTE_DOUBLE_PECULE_EMPLOYE,
} from "../lib/calculators/pecule";

type Cas = {
  label: string;
  input: {
    statut: "employe" | "ouvrier";
    brutMensuel: number;
    moisPrestes: number;
    tempsPartiel: boolean;
    tauxOccupation: number;
  };
};

const cases: Cas[] = [
  {
    label: "C1 - Employé brut 3000 €/mois, 12 mois prestés",
    input: {
      statut: "employe",
      brutMensuel: 3000,
      moisPrestes: 12,
      tempsPartiel: false,
      tauxOccupation: 100,
    },
  },
  {
    label: "C2 - Employé brut 2000 €/mois, 12 mois prestés (tranche basse)",
    input: {
      statut: "employe",
      brutMensuel: 2000,
      moisPrestes: 12,
      tempsPartiel: false,
      tauxOccupation: 100,
    },
  },
  {
    label: "C3 - Employé brut 4500 €/mois, 12 mois prestés (tranche haute)",
    input: {
      statut: "employe",
      brutMensuel: 4500,
      moisPrestes: 12,
      tempsPartiel: false,
      tauxOccupation: 100,
    },
  },
  {
    label: "C4 - Employé brut 3000 €/mois, 6 mois prestés (mi-année)",
    input: {
      statut: "employe",
      brutMensuel: 3000,
      moisPrestes: 6,
      tempsPartiel: false,
      tauxOccupation: 100,
    },
  },
  {
    label: "C5 - Ouvrier brut moyen 2500 €/mois N-1, 12 mois prestés (ONVA)",
    input: {
      statut: "ouvrier",
      brutMensuel: 2500,
      moisPrestes: 12,
      tempsPartiel: false,
      tauxOccupation: 100,
    },
  },
  {
    label: "C6 - Ouvrier brut moyen 3200 €/mois N-1, 12 mois prestés (ONVA tranche haute)",
    input: {
      statut: "ouvrier",
      brutMensuel: 3200,
      moisPrestes: 12,
      tempsPartiel: false,
      tauxOccupation: 100,
    },
  },
];

const fmt = (n: number) =>
  n.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

console.log("==============================================================");
console.log("  Validation Pécule de vacances 2026 — barèmes SPF + ONVA");
console.log("==============================================================");

for (const c of cases) {
  console.log(`\n--- ${c.label} ---`);
  const res = calcPecule(c.input);
  if ("error" in res) {
    console.log(`ERREUR : ${res.error}`);
    continue;
  }

  // Affichage détaillé
  console.log(
    `Statut             : ${res.statut === "employe" ? "Employé" : "Ouvrier ONVA"}`,
  );
  console.log(`Pécule simple brut : ${fmt(res.peculeSimpleBrut)} €`);
  console.log(`Pécule simple net  : ${fmt(res.peculeSimpleNetEstime)} €`);
  console.log(`Double pécule brut : ${fmt(res.doublePeculeBrut)} €`);
  console.log(`Double pécule net  : ${fmt(res.doublePeculeNetEstime)} €`);
  console.log(`TOTAL BRUT         : ${fmt(res.totalBrut)} €`);
  console.log(`TOTAL NET estimé   : ${fmt(res.totalNetEstime)} €`);
  console.log(
    `Taux retenue       : ${res.tauxPrecompteAppliquePourcent.toFixed(2)} % ${
      res.statut === "ouvrier" ? "(ONSS+sol+précompte)" : "(précompte spécial double)"
    }`,
  );

  // Pour les employés, on calcule manuellement le brut annuel équivalent
  // et on liste le taux retenu dans le barème.
  if (res.statut === "employe") {
    const brutAnnuelEq = c.input.brutMensuel * 12;
    const tranche =
      PRECOMPTE_DOUBLE_PECULE_EMPLOYE.find((t) => brutAnnuelEq <= t.plafond) ||
      PRECOMPTE_DOUBLE_PECULE_EMPLOYE[
        PRECOMPTE_DOUBLE_PECULE_EMPLOYE.length - 1
      ];
    const trancheSimple =
      PRECOMPTE_PECULE_SIMPLE_EMPLOYE.find((t) => brutAnnuelEq <= t.plafond) ||
      PRECOMPTE_PECULE_SIMPLE_EMPLOYE[
        PRECOMPTE_PECULE_SIMPLE_EMPLOYE.length - 1
      ];
    console.log(
      `Brut annuel équiv. : ${fmt(brutAnnuelEq)} € → tranche simple ${(trancheSimple.taux * 100).toFixed(2)} %, double ${(tranche.taux * 100).toFixed(2)} %`,
    );
  } else {
    // Ouvrier : on rappelle le brut annuel × 1,08 majoré
    const brutAnnuel = c.input.brutMensuel * 13.92;
    const brutMajore = brutAnnuel * 1.08;
    console.log(
      `Brut annuel ONVA   : ${fmt(brutAnnuel)} € → majoré 1,08 : ${fmt(brutMajore)} €`,
    );
  }
}

console.log("\n==============================================================");
console.log("  Résumé : 6 cas testés — voir tableau de comparaison externe");
console.log("==============================================================");
