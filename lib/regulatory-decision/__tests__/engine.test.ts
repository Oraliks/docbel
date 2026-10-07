import { describe, expect, it } from "vitest";
import { decideRegulatoryScenario } from "../engine";
import { decidePersonalSituation } from "../personal-situation";
import type { RegulatoryRule } from "../types";

const rule: RegulatoryRule = {
  id: "test", version: 2, sourceRuleIds: ["formulaire_c1"], explanation: "test",
  when: { type: "all", conditions: [
    { type: "equals", fact: "a", value: true },
    { type: "any", conditions: [{ type: "exists", fact: "b" }, { type: "not", condition: { type: "exists", fact: "c" } }] },
  ] }, decision: { scenarioId: "x", bundleSlug: "bundle-x" },
};

describe("regulatory decision engine", () => {
  it("supports AND, OR, NOT and preserves rule provenance", () => {
    const decision = decideRegulatoryScenario([rule], { a: { value: true, origin: "user" }, b: { value: "ok", origin: "user" } }, new Date("2026-10-07T10:00:00Z"));
    expect(decision).toMatchObject({ status: "decided", scenarioId: "x", bundleSlug: "bundle-x", ruleVersions: { test: 2 }, sourceRuleIds: ["formulaire_c1"] });
    expect(decision.legalWarning).toContain("Cet outil vous aide à vous orienter");
  });
  it("does not decide when a required fact is unknown", () => {
    const decision = decideRegulatoryScenario([rule], { a: { value: true, origin: "user" } });
    expect(decision).toMatchObject({ status: "needs_information", missingFacts: ["b", "c"] });
  });
  it("returns unsupported rather than inventing a fallback", () => {
    expect(decideRegulatoryScenario([rule], { a: { value: false, origin: "user" }, b: { value: "x", origin: "user" } }).status).toBe("unsupported");
  });
  it("returns an explicit indeterminate result when no rule exists", () => {
    const decision = decideRegulatoryScenario([], { "entry.dossier": { value: "unknown", origin: "user" } });
    expect(decision).toMatchObject({ status: "unsupported", scenarioId: null, bundleSlug: null, ruleIds: [] });
  });
  it("supports unknown, inequality and dated facts without coercion", () => {
    const unknownRule: RegulatoryRule = {
      id: "unknown", version: 1, sourceRuleIds: [], explanation: "test",
      when: { type: "all", conditions: [
        { type: "unknown", fact: "pending" },
        { type: "notEquals", fact: "status", value: "closed" },
        { type: "equals", fact: "effective", value: { kind: "date", value: "2026-10-07" } },
      ] },
      decision: { scenarioId: "review", bundleSlug: "review" },
    };
    const decision = decideRegulatoryScenario([unknownRule], {
      status: { value: "open", origin: "user" },
      effective: { value: { kind: "date", value: "2026-10-07" }, origin: "user", effectiveAt: "2026-10-07" },
    });
    expect(decision.status).toBe("decided");
  });
  it("maps the existing personal-situation C1 workflow to its bundle", () => {
    const decision = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    expect(decision).toMatchObject({ status: "decided", scenarioId: "personal-situation-c1", bundleSlug: "changement-situation-personnelle", sourceRuleIds: ["formulaire_c1", "situation_familiale_c1"] });
    expect(JSON.parse(JSON.stringify(decision))).toMatchObject({ ruleIds: ["personal-situation-c1-workflow"] });
  });
  it("keeps a serialised decision traceable after later rules evolve", () => {
    const initial = decidePersonalSituation({ "entry.dossier": { value: "changement-situation-personnelle", origin: "system" } });
    const snapshot = JSON.parse(JSON.stringify(initial));
    const evolved: RegulatoryRule = { ...rule, version: 3, explanation: "new explanation" };
    const afterEvolution = decideRegulatoryScenario([evolved], { a: { value: true, origin: "user" }, b: { value: "ok", origin: "user" } });

    expect(snapshot).toMatchObject({ ruleVersions: { "personal-situation-c1-workflow": 1 }, scenarioId: "personal-situation-c1" });
    expect(afterEvolution.ruleVersions).toEqual({ test: 3 });
  });
});
