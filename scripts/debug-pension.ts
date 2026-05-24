/**
 * Debug du calcul Pension légale (salarié) 2026.
 *
 * 6 cas de référence pour valider la cohérence du calc contre les barèmes
 * publiés par le SFP (Service Fédéral des Pensions) au 1ᵉʳ mars 2026.
 *
 * - C1 : Isolé, né 1965, 40 ans carrière, salaire 35 000 €, départ 66 ans
 *        → calcul standard
 * - C2 : Ménage, né 1965, 45 ans carrière complète, 50 000 €, départ 66
 *        → carrière complète, taux 75 %
 * - C3 : Isolé, né 1962, 44 ans à 60 ans → départ anticipé OK (60/44)
 * - C4 : Isolé, né 1970, 30 ans + 5 ans assimilées (chômage), 28 000 €,
 *        départ 67 → tester minimum garanti
 * - C5 : Ménage, salaire élevé 80 000 € (plafond appliqué), 45 ans, départ
 *        67 → tester plafond pension
 * - C6 : Isolé, demande à 62 ans avec 38 ans carrière → non éligible
 *        anticipation, calcul fait à l'âge légal pour info
 */

import {
  calcPension,
  PLAFOND_SALARIAL_2026,
  MINIMUM_ISOLE,
  MINIMUM_MENAGE,
  PLAFOND_PENSION_ISOLE,
  PLAFOND_PENSION_MENAGE,
} from "../lib/calculators/pension";

type Cas = {
  label: string;
  input: {
    dateNaissance: string;
    anneesCarriere: number;
    periodesAssimilees?: number;
    salaireMoyen: number;
    statut: "isole" | "menage";
    ageDepart: number;
  };
};

const cases: Cas[] = [
  {
    label:
      "C1 - Isolé, né 1965, 40 ans carrière, 35 000 € moyen, départ 66 (âge légal)",
    input: {
      dateNaissance: "1965-06-15",
      anneesCarriere: 40,
      periodesAssimilees: 0,
      salaireMoyen: 35000,
      statut: "isole",
      ageDepart: 66,
    },
  },
  {
    label:
      "C2 - Ménage, né 1965, 45 ans carrière, 50 000 € moyen, départ 66",
    input: {
      dateNaissance: "1965-04-01",
      anneesCarriere: 45,
      periodesAssimilees: 0,
      salaireMoyen: 50000,
      statut: "menage",
      ageDepart: 66,
    },
  },
  {
    label:
      "C3 - Isolé, né 1962, 44 ans carrière à 60 ans (anticipation OK 60/44)",
    input: {
      dateNaissance: "1962-03-10",
      anneesCarriere: 44,
      periodesAssimilees: 0,
      salaireMoyen: 42000,
      statut: "isole",
      ageDepart: 60,
    },
  },
  {
    label:
      "C4 - Isolé, né 1970, 30 ans + 5 ans assimilées, 28 000 €, départ 67 (test minimum garanti)",
    input: {
      dateNaissance: "1970-09-20",
      anneesCarriere: 30,
      periodesAssimilees: 5,
      salaireMoyen: 28000,
      statut: "isole",
      ageDepart: 67,
    },
  },
  {
    label:
      "C5 - Ménage, 45 ans, salaire 80 000 € (plafond), départ 67 (test plafond pension)",
    input: {
      dateNaissance: "1970-01-01",
      anneesCarriere: 45,
      periodesAssimilees: 0,
      salaireMoyen: 80000,
      statut: "menage",
      ageDepart: 67,
    },
  },
  {
    label:
      "C6 - Isolé, départ 62 ans avec 38 ans carrière (anticipation refusée)",
    input: {
      dateNaissance: "1968-07-12",
      anneesCarriere: 38,
      periodesAssimilees: 0,
      salaireMoyen: 38000,
      statut: "isole",
      ageDepart: 62,
    },
  },
];

const fmt = (n: number) =>
  n.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

console.log("==============================================================");
console.log("  Validation Pension légale salarié 2026 — barèmes SFP");
console.log("==============================================================");
console.log(`Constantes utilisées :`);
console.log(`  - Plafond salarial annuel : ${fmt(PLAFOND_SALARIAL_2026)} €`);
console.log(`  - Minimum isolé           : ${fmt(MINIMUM_ISOLE)} €/mois`);
console.log(`  - Minimum ménage          : ${fmt(MINIMUM_MENAGE)} €/mois`);
console.log(`  - Plafond pension isolé   : ${fmt(PLAFOND_PENSION_ISOLE)} €/mois`);
console.log(`  - Plafond pension ménage  : ${fmt(PLAFOND_PENSION_MENAGE)} €/mois`);

for (const c of cases) {
  console.log(`\n--- ${c.label} ---`);
  const res = calcPension(c.input);
  if ("error" in res) {
    console.log(`ERREUR : ${res.error}`);
    continue;
  }

  console.log(
    `Statut             : ${res.statutLabel}`,
  );
  console.log(`Âge légal          : ${res.ageLegal} ans`);
  console.log(`Âge de départ      : ${res.ageDepart} ans`);
  console.log(`Âge effectif       : ${res.ageEffectif} ans`);
  console.log(
    `Carrière effective : ${c.input.anneesCarriere} ans · assimilées : ${c.input.periodesAssimilees ?? 0} ans`,
  );
  console.log(
    `Carrière totale    : ${res.carriereTotale} ans${res.longueCarriere ? " (longue carrière, proratisée à 45/45)" : ""}`,
  );
  console.log(
    `Plafond salarial   : ${res.plafondAtteint ? "OUI (salaire plafonné)" : "non"}`,
  );
  console.log(
    `Éligible anticipation : ${
      res.eligibiliteAnticipee.possible ? "OUI" : "NON"
    }`,
  );
  if (res.eligibiliteAnticipee.raison) {
    console.log(`  Raison : ${res.eligibiliteAnticipee.raison}`);
  }
  if (
    res.eligibiliteAnticipee.conditionAge !== undefined &&
    res.eligibiliteAnticipee.conditionCarriere !== undefined
  ) {
    console.log(
      `  Condition : ${res.eligibiliteAnticipee.conditionCarriere} ans à ${res.eligibiliteAnticipee.conditionAge} ans`,
    );
  }
  console.log(`Pension mensuelle  : ${fmt(res.pensionMensuelle)} € / mois (brut)`);
  console.log(`Pension annuelle   : ${fmt(res.pensionAnnuelle)} € / an (brut)`);
}

console.log("\n==============================================================");
console.log("  Résumé : 6 cas testés — comparer à mypension.be pour validation");
console.log("==============================================================");
