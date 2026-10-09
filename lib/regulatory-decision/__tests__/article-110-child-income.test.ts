import { describe, expect, it } from "vitest";
import {
  addCalendarMonths,
  decideArticle110ChildFirstProfessionalIncome,
  preserveArticle110TemporalHistory,
} from "../article-110-child-income";
import type { RegulatoryFacts } from "../types";

const facts = (overrides: RegulatoryFacts = {}): RegulatoryFacts => ({
  "family.child.firstProfessionalIncome": { value: true, origin: "user" },
  "family.child.neutralisationRequested": { value: true, origin: "user" },
  "family.child.firstProfessionalIncomeStartedAt": {
    value: { kind: "date", value: "2026-04-01" }, origin: "user",
  },
  "family.child.studiesEndedAt": { value: { kind: "date", value: "2026-03-31" }, origin: "user" },
  ...overrides,
});

describe("Article 110 — premier revenu professionnel d'un enfant", () => {
  it("neutralises the child income with 110&1M without locking a family category", () => {
    const decision = decideArticle110ChildFirstProfessionalIncome(facts(), new Date("2027-03-31T12:00:00Z"));
    expect(decision).toMatchObject({
      status: "decided",
      temporalEffect: {
        onemCode: "110&1M", familyCategory: null, effectiveFrom: "2026-04-01",
        effectiveUntil: "2027-03-31", reassessmentAt: "2027-04-01",
      },
    });
  });

  it("moves to 110&1V at expiry without choosing B or N", () => {
    const decision = decideArticle110ChildFirstProfessionalIncome(facts(), new Date("2027-04-01T00:00:00Z"));
    expect(decision).toMatchObject({
      status: "reassessment_required",
      temporalEffect: {
        onemCode: "110&1V", familyCategory: null, effectiveFrom: "2027-04-01", reassessmentAt: "2027-04-01",
      },
    });
  });

  it("starts after the end of studies when the occupation began during them", () => {
    const decision = decideArticle110ChildFirstProfessionalIncome(facts({
      "family.child.firstProfessionalIncomeStartedAt": { value: { kind: "date", value: "2026-04-01" }, origin: "user" },
      "family.child.studiesEndedAt": { value: { kind: "date", value: "2026-06-30" }, origin: "user" },
    }), new Date("2026-07-01T00:00:00Z"));
    expect(decision.temporalEffect).toMatchObject({ effectiveFrom: "2026-07-01", reassessmentAt: "2027-07-01" });
  });

  it("requires temporal facts and never applies 110&1M from partial facts", () => {
    const incomplete = facts();
    delete incomplete["family.child.studiesEndedAt"];
    const decision = decideArticle110ChildFirstProfessionalIncome(incomplete, new Date("2026-05-01T00:00:00Z"));
    expect(decision).toMatchObject({ status: "needs_information", missingFacts: ["family.child.studiesEndedAt"] });
    expect(decision.temporalEffect).toBeUndefined();
  });

  it("uses deterministic calendar arithmetic at month ends and leap years", () => {
    expect(addCalendarMonths("2024-02-29", 12)).toBe("2025-02-28");
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("keeps the initial 110&1M snapshot when the later review is recorded", () => {
    const initial = decideArticle110ChildFirstProfessionalIncome(facts(), new Date("2026-05-01T00:00:00Z"));
    const review = decideArticle110ChildFirstProfessionalIncome(facts(), new Date("2027-04-01T00:00:00Z"));
    const preserved = preserveArticle110TemporalHistory(initial, review);
    expect(preserved.temporalHistory?.map((item) => item.onemCode)).toEqual(["110&1M", "110&1V"]);
  });
});
