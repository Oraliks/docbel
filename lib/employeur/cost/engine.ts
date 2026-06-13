/**
 * Module 2 — Moteur d'estimation du COÛT EMPLOYEUR (Docbel Employeur).
 *
 * FONCTION PURE : pas de React, pas de DB, pas de `server-only`. Sûre à importer
 * dans le navigateur pour un recalcul en direct (le formulaire client appelle
 * `estimateEmployerCost` à chaque changement).
 *
 * NATURE DU RÉSULTAT (contrainte produit décidée)
 * ----------------------------------------------
 * Estimation STRUCTURELLE NON certifiée. On expose une structure de coût
 * transparente avec des hypothèses documentées, et de lourds avertissements.
 * On NE vérifie PAS le salaire minimum sectoriel (aucune donnée de barème CP
 * n'est disponible). Un secrétariat social agréé doit valider le calcul final.
 *
 * SOURCES DES TAUX (vérifiées sur le web, juin 2026 — ordres de grandeur) :
 *  - Employé privé : cotisations patronales de BASE ≈ 25 % du brut
 *    (l'assurance accidents du travail ≈ 0,9 % et les cotisations sectorielles
 *    ne sont PAS incluses ici → léger sous-estimé). Réf. ONSS / Securex
 *    "L'ONSS pour les nouveaux employeurs", socialsecurity.be.
 *  - Ouvrier privé : ≈ 35-36 % car le pécule de vacances est financé via
 *    l'ONSS (Fonds de vacances, ≈ 11 % sur 108 %) → PAS de provision pécule
 *    séparée pour les ouvriers (sinon double comptage).
 *  - Étudiant : cotisation de solidarité employeur = 5,42 % (et 2,71 % côté
 *    travailleur), dans la limite des 650 h/an. Réf. ONSS / studentatwork.be.
 *  - Flexi-job : cotisation patronale spéciale = 28 % depuis le 01/01/2024
 *    (auparavant 25 %). Réf. socialsecurity.be/flexi-jobs, ONSS.
 *  - Double pécule de vacances (employés) : provision ≈ 7,67 %/an du brut.
 *  - 13e mois (prime de fin d'année) : ≈ 8,33 %/an (≈ 1/12) si applicable.
 *  - Chèques-repas : part employeur MAX = 8,91 €/jour depuis le 01/01/2026
 *    (valeur faciale portée à 10 €). Réf. SPF Emploi titres-repas / UCM /
 *    Securex. ≈ 20 jours prestés/mois.
 */

import type { ReliabilityLevel } from "@/lib/employeur/constants";
import { calcBrutNet } from "@/lib/calculators/brut-net";

/* ------------------------------------------------------------------ */
/*  Constantes — ordres de grandeur 2026 (à valider, structurels)     */
/* ------------------------------------------------------------------ */

/** Cotisations patronales de base ≈ 25 % du brut (EMPLOYÉ privé). */
export const EMPLOYER_ONSS_BASE = 0.25;
/** Ouvrier privé ≈ 36 % (base ≈ 25 % + Fonds de vacances ONSS ≈ 11 %). */
export const EMPLOYER_ONSS_WORKER = 0.36;
/** Étudiant : cotisation de solidarité employeur = 5,42 % (≤ 650 h/an). */
export const EMPLOYER_ONSS_STUDENT = 0.0542;
/** Flexi-job : cotisation patronale spéciale = 28 % (depuis le 01/01/2024). */
export const EMPLOYER_ONSS_FLEXI = 0.28;

/** Double pécule de vacances : provision annuelle ≈ 7,67 % du brut annuel. */
export const HOLIDAY_PAY_RATE = 0.0767;
/** 13e mois : provision annuelle ≈ 8,33 % du brut annuel (≈ 1/12). */
export const THIRTEENTH_MONTH_RATE = 0.0833;

/** Chèques-repas : part employeur par jour presté (2026). */
export const MEAL_VOUCHER_EMPLOYER_PER_DAY = 8.91;
/** Jours prestés moyens par mois (temps plein). */
export const WORKING_DAYS_PER_MONTH = 20;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type CostRegime = "temps_plein" | "temps_partiel";

export type CostReduction =
  | "premier_engagement"
  | "groupe_cible"
  | "etudiant"
  | "flexi"
  | "aucune"
  | "a_verifier";

export interface EmployerCostInput {
  /** Salaire brut mensuel (€). */
  grossMonthlySalary: number;
  regime: CostRegime;
  weeklyHours?: number | null;
  fullTimeReferenceHours?: number | null;
  /** Code workerType (voir WORKER_TYPES). */
  workerType: string;
  /** Code contractType (voir CONTRACT_TYPES). */
  contractType: string;
  jointCommitteeNumber?: string;
  region?: string;
  /** Codes d'avantages (voir BENEFIT_TYPES). */
  benefits?: string[];
  thirteenthMonth?: boolean;
  reductions?: CostReduction;
}

export interface EmployerCostResult {
  /** Cotisations patronales mensuelles estimées (€). */
  estimatedEmployerContributions: number;
  /** Coût employeur mensuel total (brut + cotisations + avantages + provisions). */
  estimatedMonthlyEmployerCost: number;
  /** Coût employeur annuel total (mensuel × 12 + provisions annuelles). */
  estimatedAnnualEmployerCost: number;
  /** Net salarié indicatif (via calcBrutNet). */
  estimatedNetSalary?: number;
  /** Taux patronal effectivement appliqué (fraction du brut). */
  employerRate: number;
  assumptions: string[];
  missingData: string[];
  reliability: ReliabilityLevel;
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Sélectionne le taux patronal selon le type de travailleur. */
function pickEmployerRate(
  workerType: string,
  assumptions: string[],
  warnings: string[]
): number {
  switch (workerType) {
    case "etudiant":
      assumptions.push(
        `Étudiant : cotisation de solidarité employeur ≈ ${(EMPLOYER_ONSS_STUDENT * 100).toFixed(2)} % du brut (et non l'ONSS plein).`
      );
      return EMPLOYER_ONSS_STUDENT;
    case "flexi_job":
      assumptions.push(
        `Flexi-job : cotisation patronale spéciale ≈ ${(EMPLOYER_ONSS_FLEXI * 100).toFixed(0)} % du brut.`
      );
      warnings.push(
        "Le régime flexi-job applique une cotisation patronale spécifique : faites vérifier l'éligibilité et le taux exact."
      );
      return EMPLOYER_ONSS_FLEXI;
    case "ouvrier":
      assumptions.push(
        `Ouvrier : cotisations patronales ≈ ${(EMPLOYER_ONSS_WORKER * 100).toFixed(0)} % du brut (base ≈ 25 % + Fonds de vacances ONSS ≈ 11 %).`
      );
      return EMPLOYER_ONSS_WORKER;
    case "employe":
      assumptions.push(
        `Employé : cotisations patronales de base ≈ ${(EMPLOYER_ONSS_BASE * 100).toFixed(0)} % du brut (assurance accidents du travail et cotisations sectorielles en sus, non incluses).`
      );
      return EMPLOYER_ONSS_BASE;
    default:
      // interim, stagiaire, autre, ou type inconnu → on retient la base mais on prévient.
      assumptions.push(
        `Type de travailleur « ${workerType || "non précisé"} » : taux patronal de base ≈ ${(EMPLOYER_ONSS_BASE * 100).toFixed(0)} % retenu par défaut.`
      );
      warnings.push(
        "Le type de travailleur retenu utilise un taux patronal par défaut : à confirmer selon le statut réel."
      );
      return EMPLOYER_ONSS_BASE;
  }
}

/** Map workerType → statut brut→net pour `calcBrutNet` (employé isolé par défaut). */
function estimateNet(grossMonthlySalary: number, benefits: string[]): number | undefined {
  const res = calcBrutNet({
    brut: grossMonthlySalary,
    statut: "isole",
    enfants: 0,
    region: "wallonie",
    chequesRepas: benefits.includes("cheques_repas"),
  });
  if ("error" in res) return undefined;
  return round2(res.net);
}

/* ------------------------------------------------------------------ */
/*  Moteur principal                                                  */
/* ------------------------------------------------------------------ */

export function estimateEmployerCost(input: EmployerCostInput): EmployerCostResult {
  const assumptions: string[] = [];
  const missingData: string[] = [];
  const warnings: string[] = [];

  const gross = isFiniteNumber(input.grossMonthlySalary)
    ? Math.max(0, input.grossMonthlySalary)
    : 0;
  const benefits = input.benefits ?? [];
  const workerType = input.workerType ?? "";
  const regime = input.regime;
  const cpKnown = !!input.jointCommitteeNumber && input.jointCommitteeNumber.trim() !== "";
  const reductions = input.reductions ?? "a_verifier";

  if (gross <= 0) {
    missingData.push("Salaire brut mensuel manquant ou invalide.");
  }

  // 1. Taux patronal + cotisations mensuelles.
  const employerRate = pickEmployerRate(workerType, assumptions, warnings);
  const estimatedEmployerContributions = round2(gross * employerRate);

  // 2. Réductions de cotisations — non chiffrées (structurel) mais signalées.
  if (reductions === "premier_engagement") {
    assumptions.push(
      "Réduction « premier engagement » potentielle : forte réduction des cotisations patronales (non chiffrée ici)."
    );
    warnings.push(
      "Une réduction « premier engagement » peut réduire fortement les cotisations : le coût réel pourrait être inférieur."
    );
  } else if (reductions === "groupe_cible") {
    assumptions.push(
      "Réduction « groupe cible » potentielle (région) : non chiffrée dans cette estimation."
    );
  } else if (reductions === "a_verifier") {
    missingData.push("Réductions de cotisations (premier engagement, groupe cible…) à vérifier.");
  }

  // 3. Provisions annuelles (pécule + 13e mois éventuel).
  const annualGross = gross * 12;
  // Ouvrier : pécule financé via l'ONSS (Fonds de vacances), déjà dans le taux.
  // Flexi-job : pécule inclus dans la rémunération flexi. → pas de provision.
  const holidayProvisioned = workerType !== "ouvrier" && workerType !== "flexi_job";
  const holidayProvision = holidayProvisioned ? round2(annualGross * HOLIDAY_PAY_RATE) : 0;
  if (holidayProvisioned) {
    assumptions.push(
      `Double pécule de vacances provisionné ≈ ${(HOLIDAY_PAY_RATE * 100).toFixed(2)} % du brut annuel.`
    );
  } else if (workerType === "ouvrier") {
    assumptions.push(
      "Ouvrier : pécule de vacances financé via l'ONSS (Fonds de vacances), déjà compris dans le taux patronal — pas de provision séparée."
    );
  } else {
    assumptions.push(
      "Flexi-job : pécule de vacances inclus dans la rémunération flexi (règles spécifiques)."
    );
  }
  let thirteenthProvision = 0;
  if (input.thirteenthMonth) {
    thirteenthProvision = round2(annualGross * THIRTEENTH_MONTH_RATE);
    assumptions.push(
      `13e mois provisionné ≈ ${(THIRTEENTH_MONTH_RATE * 100).toFixed(2)} % du brut annuel.`
    );
  } else {
    assumptions.push("13e mois non inclus (non coché).");
  }
  const annualProvisions = round2(holidayProvision + thirteenthProvision);
  const monthlyProvisionShare = round2(annualProvisions / 12);

  // 4. Avantages : chèques-repas chiffrés, le reste « non chiffré ».
  let monthlyBenefitCost = 0;
  if (benefits.includes("cheques_repas")) {
    const crMonthly = round2(MEAL_VOUCHER_EMPLOYER_PER_DAY * WORKING_DAYS_PER_MONTH);
    monthlyBenefitCost += crMonthly;
    assumptions.push(
      `Chèques-repas : part employeur ≈ ${MEAL_VOUCHER_EMPLOYER_PER_DAY.toFixed(2)} €/jour × ${WORKING_DAYS_PER_MONTH} j ≈ ${crMonthly.toFixed(2)} €/mois.`
    );
  }
  const otherBenefits = benefits.filter((b) => b !== "cheques_repas");
  if (otherBenefits.length > 0) {
    missingData.push(
      `Avantages non chiffrés dans cette estimation : ${otherBenefits.join(", ")}.`
    );
  }

  // 5. Régime / temps de travail.
  if (regime === "temps_partiel") {
    assumptions.push(
      "Temps partiel : le brut renseigné est supposé déjà proratisé pour le temps de travail réel."
    );
    if (
      isFiniteNumber(input.weeklyHours) &&
      isFiniteNumber(input.fullTimeReferenceHours) &&
      input.fullTimeReferenceHours > 0
    ) {
      const ratio = (input.weeklyHours as number) / (input.fullTimeReferenceHours as number);
      assumptions.push(
        `Fraction d'occupation ≈ ${(ratio * 100).toFixed(0)} % (${input.weeklyHours}h / ${input.fullTimeReferenceHours}h).`
      );
    } else {
      missingData.push("Heures hebdomadaires / référence temps plein non renseignées.");
    }
  }

  // 6. Coût mensuel et annuel.
  const estimatedMonthlyEmployerCost = round2(
    gross + estimatedEmployerContributions + monthlyBenefitCost + monthlyProvisionShare
  );
  const monthlyRecurring = round2(gross + estimatedEmployerContributions + monthlyBenefitCost);
  const estimatedAnnualEmployerCost = round2(monthlyRecurring * 12 + annualProvisions);

  // 7. Net indicatif.
  const estimatedNetSalary = gross > 0 ? estimateNet(gross, benefits) : undefined;

  // 8. CP inconnue → impossible de vérifier le salaire minimum.
  if (!cpKnown) {
    missingData.push("Commission paritaire non renseignée.");
  }

  // 9. Fiabilité — échelle de priorité (du plus exigeant au plus prudent).
  //   high   : tout connu, CP incluse, avantages détaillés.
  //   medium : tout l'essentiel + la CP connus, mais des avantages non chiffrés.
  //   low    : CP inconnue, ou type/régime/contrat incertain, ou brut absent.
  //
  // La CP est la donnée la plus structurante : sans elle, le salaire minimum
  // sectoriel ne peut pas être vérifié, donc l'estimation reste « low » (spec :
  // « low if CP unknown »). « medium » est réservé au cas où tout l'essentiel,
  // CP comprise, est connu mais certains avantages restent non chiffrés.
  const typeKnown =
    workerType !== "" && workerType !== "autre" && workerType !== "interim" && workerType !== "stagiaire";
  const benefitsDetailed = otherBenefits.length === 0; // aucun avantage « non chiffré »
  const regimeKnown = regime === "temps_plein" || regime === "temps_partiel";
  const contractKnown = !!input.contractType && input.contractType.trim() !== "";
  const coreKnown = gross > 0 && regimeKnown && typeKnown && contractKnown;

  let reliability: ReliabilityLevel;
  if (coreKnown && cpKnown && benefitsDetailed) {
    reliability = "high";
  } else if (coreKnown && cpKnown) {
    // Essentiel + CP connus, mais certains avantages non chiffrés → moyenne.
    reliability = "medium";
  } else {
    reliability = "low";
  }

  // 10. Avertissements systématiques (spec).
  warnings.push("Le net affiché est indicatif.");
  warnings.push("Les cotisations patronales varient selon les réductions.");
  warnings.push("Un secrétariat social doit valider le calcul final.");
  if (!cpKnown) {
    warnings.push("Commission paritaire non renseignée : salaire minimum non vérifiable.");
  }

  return {
    estimatedEmployerContributions,
    estimatedMonthlyEmployerCost,
    estimatedAnnualEmployerCost,
    estimatedNetSalary,
    employerRate,
    assumptions,
    missingData,
    reliability,
    warnings,
  };
}
