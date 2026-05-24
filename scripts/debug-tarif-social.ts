/**
 * Debug du calcul Tarif social énergie 2026 (Q2 2026).
 *
 * 6 cas de référence pour valider la cohérence du calc contre les tarifs
 * officiels CREG et la liste des bénéficiaires SPF Économie. Tous les cas
 * couvrent les permutations principales :
 *   - éligibilité simple (1 motif), multiple (2 motifs) et nulle
 *   - chauffage gaz vs chauffage élec
 *   - ménages de 1 à 5 personnes
 *   - consommations excédant les plafonds (gros consommateurs)
 *
 * IMPORTANT — Le statut BIM seul N'OUVRE PLUS le droit au tarif social
 * automatique depuis le 1ᵉʳ juillet 2023. C1 (BIM seul) doit donc renvoyer
 * `eligible: false` avec une note explicative dans `result.notes`.
 *
 * Usage : pnpm tsx scripts/debug-tarif-social.ts
 */

import {
  calcTarifSocial,
  PLAFONDS_2026,
  Q_REFERENCE,
  TARIFS_2026,
  type TarifSocialInput,
} from "../lib/calculators/tarif-social";

type Cas = {
  label: string;
  input: TarifSocialInput;
  attendu?: {
    eligible: boolean;
    motifsCount: number;
  };
};

const cases: Cas[] = [
  {
    label: "C1 - Ménage 2 pers, BIM seul, 3 500 kWh élec, 17 000 kWh gaz, chauffage gaz",
    input: {
      bim: true,
      ris: false,
      grapa: false,
      handicap: false,
      aideEquivalente: false,
      logementSocial: false,
      consoElecKwh: 3500,
      consoGazKwh: 17000,
      chauffageElec: false,
      chauffageGaz: true,
      tailleMenage: 2,
    },
    attendu: { eligible: false, motifsCount: 0 },
  },
  {
    label: "C2 - 1 pers, RIS, 2 200 kWh élec, 0 kWh gaz, chauffage élec",
    input: {
      bim: false,
      ris: true,
      grapa: false,
      handicap: false,
      aideEquivalente: false,
      logementSocial: false,
      consoElecKwh: 2200,
      consoGazKwh: 0,
      chauffageElec: true,
      chauffageGaz: false,
      tailleMenage: 1,
    },
    attendu: { eligible: true, motifsCount: 1 },
  },
  {
    label: "C3 - Ménage 4 pers, GRAPA, 4 000 kWh élec, 22 000 kWh gaz, chauffage gaz",
    input: {
      bim: false,
      ris: false,
      grapa: true,
      handicap: false,
      aideEquivalente: false,
      logementSocial: false,
      consoElecKwh: 4000,
      consoGazKwh: 22000,
      chauffageElec: false,
      chauffageGaz: true,
      tailleMenage: 4,
    },
    attendu: { eligible: true, motifsCount: 1 },
  },
  {
    label: "C4 - Ménage 5 pers, logement social, 5 200 kWh élec, 25 000 kWh gaz (excédent), chauffage gaz",
    input: {
      bim: false,
      ris: false,
      grapa: false,
      handicap: false,
      aideEquivalente: false,
      logementSocial: true,
      consoElecKwh: 5200,
      consoGazKwh: 25000,
      chauffageElec: false,
      chauffageGaz: true,
      tailleMenage: 5,
    },
    attendu: { eligible: true, motifsCount: 1 },
  },
  {
    label: "C5 - Non-éligible (rien coché), 3 500 kWh élec, 17 000 kWh gaz, chauffage gaz",
    input: {
      bim: false,
      ris: false,
      grapa: false,
      handicap: false,
      aideEquivalente: false,
      logementSocial: false,
      consoElecKwh: 3500,
      consoGazKwh: 17000,
      chauffageElec: false,
      chauffageGaz: true,
      tailleMenage: 2,
    },
    attendu: { eligible: false, motifsCount: 0 },
  },
  {
    label: "C6 - 2 pers, BIM + RIS, 6 000 kWh élec chauffage élec (excédent élec), pas de gaz",
    input: {
      bim: true,
      ris: true,
      grapa: false,
      handicap: false,
      aideEquivalente: false,
      logementSocial: false,
      consoElecKwh: 6000,
      consoGazKwh: 0,
      chauffageElec: true,
      chauffageGaz: false,
      tailleMenage: 2,
    },
    attendu: { eligible: true, motifsCount: 1 },
  },
];

const fmt = (n: number) =>
  n.toLocaleString("fr-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtKwh = (n: number) =>
  n.toLocaleString("fr-BE", { maximumFractionDigits: 0 });

console.log("===============================================================");
console.log(`  Validation Tarif social énergie ${Q_REFERENCE}`);
console.log("===============================================================");
console.log(
  `  Tarifs CREG : élec ${(TARIFS_2026.ELEC_SOCIAL * 100).toFixed(3)} c€/kWh · gaz ${(TARIFS_2026.GAZ_SOCIAL * 100).toFixed(3)} c€/kWh`,
);
console.log(
  `  Tarif standard moyen : élec ${(TARIFS_2026.ELEC_STANDARD * 100).toFixed(1)} c€/kWh · gaz ${(TARIFS_2026.GAZ_STANDARD * 100).toFixed(1)} c€/kWh`,
);
console.log(
  `  Plafonds : élec ${PLAFONDS_2026.ELEC_BASE} kWh (base) / ${PLAFONDS_2026.ELEC_CHAUFFAGE} kWh (chauff élec) + ${PLAFONDS_2026.ELEC_PAR_PERSONNE}/pers · gaz ${PLAFONDS_2026.GAZ_NON_CHAUFFAGE} kWh (cuisine) / ${PLAFONDS_2026.GAZ_CHAUFFAGE} kWh (chauff gaz)`,
);

let passes = 0;
let failures = 0;

for (const c of cases) {
  console.log(`\n--- ${c.label} ---`);

  // Inputs résumés
  const statuts: string[] = [];
  if (c.input.bim) statuts.push("BIM");
  if (c.input.ris) statuts.push("RIS");
  if (c.input.grapa) statuts.push("GRAPA");
  if (c.input.handicap) statuts.push("handicap");
  if (c.input.aideEquivalente) statuts.push("aide CPAS");
  if (c.input.logementSocial) statuts.push("logement social");
  console.log(`Statuts cochés     : ${statuts.length > 0 ? statuts.join(", ") : "(aucun)"}`);
  console.log(
    `Conso              : élec ${fmtKwh(c.input.consoElecKwh)} kWh · gaz ${fmtKwh(c.input.consoGazKwh)} kWh`,
  );
  console.log(
    `Chauffage          : élec=${c.input.chauffageElec ? "oui" : "non"} · gaz=${c.input.chauffageGaz ? "oui" : "non"} · ménage ${c.input.tailleMenage}`,
  );

  const res = calcTarifSocial(c.input);
  if ("error" in res) {
    console.log(`ERREUR : ${res.error}`);
    failures++;
    continue;
  }

  console.log(`Éligible           : ${res.eligible ? "OUI" : "NON"}`);
  if (res.motifsEligibilite.length > 0) {
    console.log(
      `Motif(s)           : ${res.motifsEligibilite.join(" + ")}`,
    );
  }
  if (res.notes.length > 0) {
    res.notes.forEach((n) => console.log(`Note               : ${n}`));
  }
  console.log(
    `Plafonds appliqués : élec ${fmtKwh(res.plafondElec)} kWh · gaz ${fmtKwh(res.plafondGaz)} kWh`,
  );
  if (res.consoExcedentElec > 0 || res.consoExcedentGaz > 0) {
    console.log(
      `Excédent           : élec ${fmtKwh(res.consoExcedentElec)} kWh · gaz ${fmtKwh(res.consoExcedentGaz)} kWh`,
    );
  }
  console.log(`Économie élec      : ${fmt(res.gainElec)} €`);
  console.log(`Économie gaz       : ${fmt(res.gainGaz)} €`);
  console.log(`GAIN ANNUEL        : ${fmt(res.gainAnnuel)} €`);
  console.log(`Gain mensuel       : ${fmt(res.gainMensuel)} €`);
  console.log(
    `Coût standard      : ${fmt(res.coutStandardTotal)} € · social : ${fmt(res.coutSocialTotal)} €`,
  );

  // Vérification des attentes
  if (c.attendu) {
    const okEligible = res.eligible === c.attendu.eligible;
    const okMotifs = res.motifsEligibilite.length === c.attendu.motifsCount;
    if (okEligible && okMotifs) {
      console.log(`✓ Attendu OK`);
      passes++;
    } else {
      console.log(
        `✗ Attendu FAIL : eligible attendu=${c.attendu.eligible} obtenu=${res.eligible}, motifs attendu=${c.attendu.motifsCount} obtenu=${res.motifsEligibilite.length}`,
      );
      failures++;
    }
  }
}

console.log("\n===============================================================");
console.log(`  Résumé : ${passes} OK / ${failures} FAIL sur ${cases.length} cas`);
console.log("===============================================================");

if (failures > 0) process.exit(1);
