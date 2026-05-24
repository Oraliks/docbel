/**
 * Debug du calcul Frais kilométriques domicile-travail 2026 (revenus 2026 / EI 2027).
 *
 * 6 cas de référence pour valider la cohérence du calc contre les sources
 * officielles de l'État belge :
 *   - Voiture : tarif fonctionnaires Q2 2026 (circulaire BOSA n° 764 = 0,4327 €/km)
 *               et forfait CIR 92 art. 66 (0,15 €/km)
 *   - Vélo : 0,37 €/km plafonné à 3 700 €/an (SPF Finances + SPF Mobilité)
 *   - Transports publics : 100 % de l'abonnement (SNCB / STIB / TEC / De Lijn)
 *   - Forfait légal frais pro : 6 070 €/an (CIR 92 art. 51)
 *
 * Cas couverts :
 *   - C1 : voiture trajet moyen (25 km AS, plein temps) — sans indemnité employeur
 *   - C2 : voiture long trajet (120 km AS) — dépasse plafond 100 km AS
 *   - C3 : voiture + indemnité employeur — bascule 0,4327 → 0,15 €/km
 *   - C4 : vélo quotidien (15 km AS) — vérifier plafond 3 700 €/an
 *   - C5 : transports publics — abonnement SNCB 1 200 €/an
 *   - C6 : voiture + 2 jours télétravail — affichage km évités
 *
 * Usage : pnpm tsx scripts/debug-frais-km.ts
 */

import {
  calcFraisKm,
  FORFAIT_LEGAL_FRAIS_PRO_2026,
  PLAFOND_ANNUEL_VELO_2026,
  TAUX_KM_2026,
  type FraisKmInput,
} from "../lib/calculators/frais-km";

type Cas = {
  label: string;
  input: FraisKmInput;
};

const cases: Cas[] = [
  {
    label:
      "C1 - Voiture 25 km AS, 5j/sem, 44 sem (trajet moyen, sans indemnité employeur)",
    input: {
      kmAllerSimple: 25,
      joursParSemaine: 5,
      semainesParAn: 44,
      transport: "voiture",
      coutAbonnement: 0,
      joursTelework: 0,
      indemniteEmployeurAnnuelle: 0,
    },
  },
  {
    label:
      "C2 - Voiture 120 km AS, 5j/sem, 44 sem (dépasse plafond 100 km AS — mix tarif/forfait)",
    input: {
      kmAllerSimple: 120,
      joursParSemaine: 5,
      semainesParAn: 44,
      transport: "voiture",
      coutAbonnement: 0,
      joursTelework: 0,
      indemniteEmployeurAnnuelle: 0,
    },
  },
  {
    label:
      "C3 - Voiture 25 km AS, indemnité employeur 1 500 €/an (bascule 0,4327 → 0,15 €/km + compensation)",
    input: {
      kmAllerSimple: 25,
      joursParSemaine: 5,
      semainesParAn: 44,
      transport: "voiture",
      coutAbonnement: 0,
      joursTelework: 0,
      indemniteEmployeurAnnuelle: 1500,
    },
  },
  {
    label:
      "C4 - Vélo 15 km AS, 5j/sem, 44 sem (test plafond annuel 3 700 €)",
    input: {
      kmAllerSimple: 15,
      joursParSemaine: 5,
      semainesParAn: 44,
      transport: "velo",
      coutAbonnement: 0,
      joursTelework: 0,
      indemniteEmployeurAnnuelle: 0,
    },
  },
  {
    label:
      "C5 - Transports publics, abonnement SNCB 1 200 €/an, 30 km AS, 5j/sem",
    input: {
      kmAllerSimple: 30,
      joursParSemaine: 5,
      semainesParAn: 44,
      transport: "transports_publics",
      coutAbonnement: 1200,
      joursTelework: 0,
      indemniteEmployeurAnnuelle: 0,
    },
  },
  {
    label:
      "C6 - Voiture 30 km AS, 3j sur place + 2j télétravail, 44 sem (km évités affichés)",
    input: {
      kmAllerSimple: 30,
      joursParSemaine: 3,
      semainesParAn: 44,
      transport: "voiture",
      coutAbonnement: 0,
      joursTelework: 2,
      indemniteEmployeurAnnuelle: 0,
    },
  },
];

const fmt = (n: number) =>
  n.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtKm = (n: number) =>
  n.toLocaleString("fr-BE", { maximumFractionDigits: 0 });

console.log(
  "===============================================================",
);
console.log("  Validation Frais kilométriques domicile-travail — 2026");
console.log("  (revenus 2026 / EI 2027)");
console.log(
  "===============================================================",
);
console.log(
  `  Voiture (sans indemnité, Q2 2026) : ${fmt(TAUX_KM_2026.voiture)} €/km`,
);
console.log(`  Voiture (avec indemnité / >100 km AS) : 0,15 €/km (CIR 92 art. 66)`);
console.log(
  `  Vélo : ${fmt(TAUX_KM_2026.velo)} €/km plafonné à ${fmt(PLAFOND_ANNUEL_VELO_2026)} €/an`,
);
console.log(`  Moto : ${fmt(TAUX_KM_2026.moto)} €/km`);
console.log(`  Covoiturage passager : ${fmt(TAUX_KM_2026.covoiturage)} €/km (plafond 100 km AS)`);
console.log(`  Transports publics : 100 % de l'abonnement`);
console.log(
  `  Forfait légal frais pro : ${fmt(FORFAIT_LEGAL_FRAIS_PRO_2026)} €/an (CIR 92 art. 51)`,
);

console.log("\n");
console.log("┌─────┬──────────┬────────┬─────────┬──────────┬──────────┬──────────┐");
console.log("│ Cas │ Km/an    │ Taux   │ Brute   │ Indem.   │ Nette    │ Reco     │");
console.log("├─────┼──────────┼────────┼─────────┼──────────┼──────────┼──────────┤");

for (const c of cases) {
  const res = calcFraisKm(c.input);
  if ("error" in res) {
    console.log(`│ FAIL │ ${c.label.slice(0, 4)} │ ${res.error}`);
    continue;
  }
  const id = c.label.slice(0, 2);
  const tauxStr =
    typeof res.tauxApplique === "number"
      ? `${res.tauxApplique.toFixed(4).replace(".", ",")}`
      : "100 % abo";
  console.log(
    `│ ${id.padEnd(3)} │ ${fmtKm(res.kmTotalAnnuel).padStart(8)} │ ${tauxStr.padStart(6)} │ ${fmt(res.deductionKmBrute).padStart(7)} │ ${fmt(res.indemniteEmployeurAnnuelle).padStart(8)} │ ${fmt(res.deductionKmNette).padStart(8)} │ ${(res.recommandationFraisReels ? "réels" : "forfait").padEnd(8)} │`,
  );
}

console.log("└─────┴──────────┴────────┴─────────┴──────────┴──────────┴──────────┘");

console.log("\n--- Détail par cas ---");

for (const c of cases) {
  console.log(`\n${c.label}`);
  const res = calcFraisKm(c.input);
  if ("error" in res) {
    console.log(`  ERREUR : ${res.error}`);
    continue;
  }
  console.log(`  Mode appliqué      : ${res.modeLabel}`);
  console.log(
    `  Trajet             : ${c.input.kmAllerSimple} km AS × 2 × ${c.input.joursParSemaine} j/sem × ${c.input.semainesParAn} sem`,
  );
  console.log(`  Km annuels         : ${fmtKm(res.kmTotalAnnuel)} km`);
  console.log(
    `  Taux appliqué      : ${typeof res.tauxApplique === "number" ? `${res.tauxApplique.toFixed(4).replace(".", ",")} €/km` : res.tauxApplique}`,
  );
  if (res.abonnementInclus > 0) {
    console.log(`  Abonnement inclus  : ${fmt(res.abonnementInclus)} €`);
  }
  if (res.plafondAtteint) {
    console.log(
      `  Plafond            : ATTEINT (${c.input.transport === "velo" ? "vélo 3 700 €/an" : "100 km AS — excédent à 0,15 €/km"})`,
    );
  }
  console.log(`  Déduction brute    : ${fmt(res.deductionKmBrute)} €`);
  if (res.indemniteEmployeurAnnuelle > 0) {
    console.log(
      `  Indemnité employeur: − ${fmt(res.indemniteEmployeurAnnuelle)} € (soustraite, CIR 92 art. 66)`,
    );
  }
  console.log(`  Déduction NETTE    : ${fmt(res.deductionKmNette)} €/an`);
  if (
    typeof res.kmTeleworkEvites === "number" &&
    res.kmTeleworkEvites > 0
  ) {
    console.log(
      `  Km évités (info)   : ${fmtKm(res.kmTeleworkEvites)} km/an (télétravail)`,
    );
  }
  const ecart = res.deductionKmNette - FORFAIT_LEGAL_FRAIS_PRO_2026;
  console.log(
    `  Vs forfait 6 070 € : ${ecart >= 0 ? "+" : ""}${fmt(ecart)} € — ${res.recommandationFraisReels ? "FRAIS RÉELS probablement avantageux" : "forfait légal probablement préférable"}`,
  );
}

console.log("\n");
console.log(
  "===============================================================",
);
console.log(
  `  Résumé : 6 cas testés — barème Q2 2026 (circulaire BOSA n° 764)`,
);
console.log(
  "===============================================================",
);
