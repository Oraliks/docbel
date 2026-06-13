import { describe, it, expect } from "vitest";
import { evaluateRules, type EngineResult, type EngineRule } from "../engine";
import { STARTER_RULES } from "../../data/starter-rules";
import type { ProfileFacts, ScenarioFacts } from "../payload";

const RULES: EngineRule[] = STARTER_RULES;

function run(profile: ProfileFacts, scenario: ScenarioFacts): EngineResult {
  return evaluateRules(profile, scenario, RULES);
}

const itemTitles = (r: EngineResult) => r.items.map((i) => i.title.toLowerCase());
const hasItem = (r: EngineResult, needle: string) =>
  itemTitles(r).some((t) => t.includes(needle.toLowerCase()));
const hasAlert = (r: EngineResult, needle: string) =>
  r.alerts.some((a) => a.message.toLowerCase().includes(needle.toLowerCase()));

describe("moteur de règles employeur", () => {
  it("Critère 1 — premier engagement (pas de personnel, pas d'ONSS) → WIDE + Dimona", () => {
    const r = run(
      { hasEmployees: false, hasOnssNumber: false },
      {
        workerType: "employe",
        contractType: "cdi",
        plannedStartDate: new Date("2026-09-01"),
        jointCommitteeNumber: "200",
      }
    );
    expect(r.firedRuleCodes).toContain("first_engagement_wide");
    expect(hasItem(r, "wide")).toBe(true);
    expect(hasItem(r, "dimona")).toBe(true);
    // CP renseignée → fiabilité non dégradée.
    expect(r.reliability).toBe("medium");
    // Items obligatoires triés en tête.
    expect(r.items[0]?.priority).toBe("obligatoire");
  });

  it("hasOnssNumber = inconnu (null) déclenche aussi WIDE (op falsy)", () => {
    const r = run(
      { hasEmployees: false, hasOnssNumber: null },
      { workerType: "employe", contractType: "cdi", jointCommitteeNumber: "200" }
    );
    expect(r.firedRuleCodes).toContain("first_engagement_wide");
  });

  it("employeur établi avec ONSS → pas de WIDE", () => {
    const r = run(
      { hasEmployees: true, hasOnssNumber: true },
      { workerType: "employe", contractType: "cdi", jointCommitteeNumber: "200" }
    );
    expect(r.firedRuleCodes).not.toContain("first_engagement_wide");
    expect(hasItem(r, "dimona")).toBe(true); // salarié → Dimona quand même
  });

  it("Critère 2 — temps partiel (contractType) → alerte écrit régime + horaire", () => {
    const r = run(
      { hasEmployees: true, hasOnssNumber: true },
      { workerType: "employe", contractType: "temps_partiel", jointCommitteeNumber: "200" }
    );
    expect(r.firedRuleCodes).toContain("part_time_written");
    expect(hasAlert(r, "horaire")).toBe(true);
    expect(hasItem(r, "temps partiel")).toBe(true);
  });

  it("Critère 2bis — temps partiel dérivé des heures (20 < 38)", () => {
    const r = run(
      { hasEmployees: true, hasOnssNumber: true },
      {
        workerType: "employe",
        contractType: "cdi",
        weeklyHours: 20,
        fullTimeReferenceHours: 38,
        jointCommitteeNumber: "200",
      }
    );
    expect(r.firedRuleCodes).toContain("part_time_written");
  });

  it("Critère 3 — CP inconnue → fiabilité faible + alerte salaire minimum", () => {
    const r = run(
      { hasEmployees: true, hasOnssNumber: true },
      { workerType: "employe", contractType: "cdi", jointCommitteeNumber: "" }
    );
    expect(r.firedRuleCodes).toContain("cp_unknown_reliability");
    expect(r.reliability).toBe("low");
    expect(hasAlert(r, "salaire minimum")).toBe(true);
  });

  it("salaire encodé sans CP → alerte barème non vérifiable", () => {
    const r = run(
      { hasEmployees: true, hasOnssNumber: true },
      { workerType: "employe", contractType: "cdi", grossMonthlySalary: 2500, jointCommitteeNumber: "" }
    );
    expect(r.firedRuleCodes).toContain("salary_vs_cp");
    expect(hasAlert(r, "barème")).toBe(true);
  });

  it("Critère 4 — étudiant → checklist spécifique + mentions obligatoires", () => {
    const r = run(
      { hasEmployees: true, hasOnssNumber: true },
      { workerType: "etudiant", contractType: "etudiant", jointCommitteeNumber: "200" }
    );
    expect(r.firedRuleCodes).toContain("student_checklist");
    expect(hasItem(r, "étudiant")).toBe(true);
    expect(hasItem(r, "mentions obligatoires")).toBe(true);
    expect(hasAlert(r, "mentions obligatoires")).toBe(true);
  });

  it("Critère 5 — flexi-job → alerte contrat-cadre écrit", () => {
    const r = run(
      { hasEmployees: true, hasOnssNumber: true },
      { workerType: "flexi_job", contractType: "flexi_job", jointCommitteeNumber: "302" }
    );
    expect(r.firedRuleCodes).toContain("flexi_contract_frame");
    expect(hasAlert(r, "contrat-cadre")).toBe(true);
    expect(hasItem(r, "contrat-cadre")).toBe(true);
  });

  it("fiabilité par défaut = medium quand rien ne la dégrade", () => {
    const r = run(
      { hasEmployees: true, hasOnssNumber: true },
      { workerType: "employe", contractType: "cdi", jointCommitteeNumber: "200" }
    );
    expect(r.reliability).toBe("medium");
  });

  it("règle inactive ignorée", () => {
    const rules: EngineRule[] = STARTER_RULES.map((r) =>
      r.code === "dimona_required" ? { ...r, active: false } : r
    );
    const r = evaluateRules(
      { hasEmployees: true, hasOnssNumber: true },
      { workerType: "employe", contractType: "cdi", jointCommitteeNumber: "200" },
      rules
    );
    expect(r.firedRuleCodes).not.toContain("dimona_required");
  });
});
