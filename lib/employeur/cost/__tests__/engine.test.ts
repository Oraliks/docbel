import { describe, it, expect } from "vitest";
import {
  estimateEmployerCost,
  EMPLOYER_ONSS_BASE,
  EMPLOYER_ONSS_WORKER,
  EMPLOYER_ONSS_STUDENT,
  HOLIDAY_PAY_RATE,
  type EmployerCostInput,
} from "../engine";

function base(overrides: Partial<EmployerCostInput> = {}): EmployerCostInput {
  return {
    grossMonthlySalary: 2500,
    regime: "temps_plein",
    workerType: "employe",
    contractType: "cdi",
    jointCommitteeNumber: "200",
    benefits: [],
    thirteenthMonth: false,
    reductions: "aucune",
    ...overrides,
  };
}

describe("estimateEmployerCost", () => {
  it("un brut plus élevé produit un coût mensuel plus élevé", () => {
    const low = estimateEmployerCost(base({ grossMonthlySalary: 2000 }));
    const high = estimateEmployerCost(base({ grossMonthlySalary: 4000 }));
    expect(high.estimatedMonthlyEmployerCost).toBeGreaterThan(
      low.estimatedMonthlyEmployerCost
    );
    expect(high.estimatedAnnualEmployerCost).toBeGreaterThan(
      low.estimatedAnnualEmployerCost
    );
  });

  it("CP vide → fiabilité « low » et avertissement dédié", () => {
    const r = estimateEmployerCost(base({ jointCommitteeNumber: "" }));
    expect(r.reliability).toBe("low");
    expect(r.warnings).toContain(
      "Commission paritaire non renseignée : salaire minimum non vérifiable."
    );
    expect(r.missingData).toContain("Commission paritaire non renseignée.");
  });

  it("CP connue + tout l'essentiel renseigné → fiabilité « high »", () => {
    const r = estimateEmployerCost(base());
    expect(r.reliability).toBe("high");
  });

  it("le taux étudiant produit des cotisations plus faibles que le standard à brut égal", () => {
    const gross = 2500;
    const standard = estimateEmployerCost(base({ grossMonthlySalary: gross, workerType: "employe" }));
    const student = estimateEmployerCost(base({ grossMonthlySalary: gross, workerType: "etudiant" }));
    expect(student.estimatedEmployerContributions).toBeLessThan(
      standard.estimatedEmployerContributions
    );
    expect(student.employerRate).toBe(EMPLOYER_ONSS_STUDENT);
    expect(standard.employerRate).toBe(EMPLOYER_ONSS_BASE);
  });

  it("cotisations = brut × taux patronal", () => {
    const gross = 3000;
    const r = estimateEmployerCost(base({ grossMonthlySalary: gross }));
    expect(r.estimatedEmployerContributions).toBeCloseTo(gross * EMPLOYER_ONSS_BASE, 2);
  });

  it("cohérence : annuel ≈ (brut+cotisations+avantages)×12 + provisions annuelles", () => {
    const gross = 2800;
    const r = estimateEmployerCost(
      base({ grossMonthlySalary: gross, benefits: ["cheques_repas"], thirteenthMonth: true })
    );
    // provisions annuelles = pécule (7,67 %) + 13e mois (8,33 %)
    const annualGross = gross * 12;
    const provisions =
      Math.round(annualGross * HOLIDAY_PAY_RATE * 100) / 100 +
      Math.round(annualGross * 0.0833 * 100) / 100;
    const monthlyRecurring =
      gross + r.estimatedEmployerContributions + 8.91 * 20; // chèques-repas
    expect(r.estimatedAnnualEmployerCost).toBeCloseTo(
      Math.round(monthlyRecurring * 100) / 100 * 12 + Math.round(provisions * 100) / 100,
      0
    );
  });

  it("le coût mensuel inclut bien la part mensuelle des provisions (≥ brut + cotisations)", () => {
    const r = estimateEmployerCost(base({ grossMonthlySalary: 2500, thirteenthMonth: true }));
    expect(r.estimatedMonthlyEmployerCost).toBeGreaterThan(
      2500 + r.estimatedEmployerContributions
    );
  });

  it("expose un net indicatif pour un brut valide", () => {
    const r = estimateEmployerCost(base({ grossMonthlySalary: 2500 }));
    expect(typeof r.estimatedNetSalary).toBe("number");
    expect(r.estimatedNetSalary as number).toBeGreaterThan(0);
    expect(r.estimatedNetSalary as number).toBeLessThan(2500);
  });

  it("avertissements systématiques toujours présents", () => {
    const r = estimateEmployerCost(base());
    expect(r.warnings).toContain("Le net affiché est indicatif.");
    expect(r.warnings).toContain("Les cotisations patronales varient selon les réductions.");
    expect(r.warnings).toContain("Un secrétariat social doit valider le calcul final.");
  });

  it("ouvrier : taux patronal plus élevé que l'employé, sans double-comptage du pécule", () => {
    const emp = estimateEmployerCost(base({ workerType: "employe" }));
    const ouv = estimateEmployerCost(base({ workerType: "ouvrier" }));
    expect(ouv.employerRate).toBe(EMPLOYER_ONSS_WORKER);
    expect(ouv.employerRate).toBeGreaterThan(emp.employerRate);
    // Pécule financé via l'ONSS → pas de provision « double pécule » séparée.
    expect(ouv.assumptions.some((a) => a.toLowerCase().includes("fonds de vacances"))).toBe(true);
    expect(
      ouv.assumptions.some((a) => a.toLowerCase().includes("double pécule de vacances provisionné"))
    ).toBe(false);
  });

  it("flexi-job : taux 28 % et avertissement spécifique", () => {
    const r = estimateEmployerCost(base({ workerType: "flexi_job" }));
    expect(r.employerRate).toBe(0.28);
    expect(r.warnings.some((w) => w.toLowerCase().includes("flexi"))).toBe(true);
  });

  it("avantage non chiffré (voiture) → présent dans missingData et bloque le « high »", () => {
    const r = estimateEmployerCost(base({ benefits: ["voiture"] }));
    expect(r.missingData.some((m) => m.includes("voiture"))).toBe(true);
    expect(r.reliability).not.toBe("high");
  });
});
