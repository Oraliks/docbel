import { describe, expect, it } from "vitest";
import { analysePayslip, type PayslipControlResult } from "../engine";

function codes(result: PayslipControlResult): string[] {
  return result.findings.map((f) => f.code);
}

describe("analysePayslip", () => {
  it("flags missing CP with code cp_absente and sourceCode S8", () => {
    const result = analysePayslip({
      grossMonthlySalary: 2500,
      regime: "temps_plein",
      jointCommitteeNumber: "",
    });
    const cp = result.findings.find((f) => f.code === "cp_absente");
    expect(cp).toBeDefined();
    expect(cp?.level).toBe("attention");
    expect(cp?.sourceCode).toBe("S8");
  });

  it("returns verdict 'insufficient' when gross salary is absent", () => {
    const result = analysePayslip({
      netReceived: 1900,
      regime: "temps_plein",
      jointCommitteeNumber: "200",
    });
    expect(result.verdict).toBe("insufficient");
    expect(result.findings.some((f) => f.code === "brut_absent")).toBe(true);
  });

  it("returns verdict 'insufficient' when nothing usable is encoded", () => {
    const result = analysePayslip({});
    expect(result.verdict).toBe("insufficient");
  });

  it("flags an 'attention' finding when net is far from the estimate", () => {
    const result = analysePayslip({
      grossMonthlySalary: 2500,
      netReceived: 800, // far below ~2100 € expected net
      regime: "temps_plein",
      jointCommitteeNumber: "200",
    });
    const net = result.findings.find((f) => f.code === "net_incoherent");
    expect(net).toBeDefined();
    expect(net?.level).toBe("attention");
    expect(result.verdict).toBe("points_to_check");
  });

  it("returns verdict 'ok' for a clean full-time input with consistent net", () => {
    // Brut 2500 € → net estimé ~2143 € (cf. brut-net.ts). On encode ce net.
    const expectedNet = 2143;
    const result = analysePayslip({
      grossMonthlySalary: 2500,
      netReceived: expectedNet,
      regime: "temps_plein",
      jointCommitteeNumber: "200",
      weeklyHours: 38,
      fullTimeReferenceHours: 38,
      workerType: "employe",
    });
    expect(result.verdict).toBe("ok");
    expect(result.findings.some((f) => f.code === "aucune_incoherence")).toBe(true);
    // Pas de constat attention/critique sur un cas propre.
    expect(result.findings.some((f) => f.level !== "info")).toBe(false);
  });

  it("flags temps_partiel without weeklyHours (code + S6)", () => {
    const result = analysePayslip({
      grossMonthlySalary: 1200,
      regime: "temps_partiel",
      jointCommitteeNumber: "200",
    });
    const finding = result.findings.find((f) => f.code === "temps_partiel_sans_horaire");
    expect(finding).toBeDefined();
    expect(finding?.level).toBe("attention");
    expect(finding?.sourceCode).toBe("S6");
    expect(result.verdict).toBe("points_to_check");
  });

  it("flags a full-time / hours incoherence", () => {
    const result = analysePayslip({
      grossMonthlySalary: 2500,
      regime: "temps_plein",
      jointCommitteeNumber: "200",
      weeklyHours: 20,
      fullTimeReferenceHours: 38,
    });
    expect(codes(result)).toContain("incoherence_temps_plein");
  });

  it("flags a flexi-job without contrat-cadre mention (S10)", () => {
    const result = analysePayslip({
      grossMonthlySalary: 1500,
      regime: "temps_plein",
      jointCommitteeNumber: "302",
      workerType: "flexi_job",
    });
    const finding = result.findings.find((f) => f.code === "flexi_sans_contrat_cadre");
    expect(finding?.sourceCode).toBe("S10");
  });

  it("does not flag flexi when contrat-cadre is mentioned in remarque", () => {
    const result = analysePayslip({
      grossMonthlySalary: 1500,
      regime: "temps_plein",
      jointCommitteeNumber: "302",
      workerType: "flexi_job",
      remarque: "Contrat-cadre signé le 01/05/2026",
    });
    expect(codes(result)).not.toContain("flexi_sans_contrat_cadre");
  });

  it("flags declared benefits without amounts as info", () => {
    const result = analysePayslip({
      grossMonthlySalary: 2500,
      netReceived: 2143,
      regime: "temps_plein",
      jointCommitteeNumber: "200",
      weeklyHours: 38,
      fullTimeReferenceHours: 38,
      workerType: "employe",
      benefits: ["cheques_repas"],
    });
    const finding = result.findings.find((f) => f.code === "avantage_non_pris_en_compte");
    expect(finding?.level).toBe("info");
  });
});
