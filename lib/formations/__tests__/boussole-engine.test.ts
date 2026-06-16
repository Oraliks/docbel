import { describe, it, expect } from "vitest";
import { scoreBoussole } from "../boussole/engine";
import { QUESTIONS } from "../boussole/questions";
import { BRANCH_KEYS } from "../boussole/branches";

describe("scoreBoussole", () => {
  it("returns an empty result when nothing is answered", () => {
    const r = scoreBoussole(QUESTIONS, {});
    expect(r.primaryKey).toBeNull();
    expect(r.secondaryKeys).toHaveLength(0);
    expect(r.totalScore).toBe(0);
    expect(r.confidence).toBe(0);
    expect(r.confidenceLabel).toBe("low");
    expect(r.ranking).toHaveLength(BRANCH_KEYS.length);
  });

  it("ignores 'je ne sais pas' (no signal, no points)", () => {
    const answers = Object.fromEntries(QUESTIONS.map((q) => [q.key, "je_ne_sais_pas"]));
    const r = scoreBoussole(QUESTIONS, answers);
    expect(r.totalScore).toBe(0);
    expect(r.signalCount).toBe(0);
    expect(r.answeredCount).toBe(QUESTIONS.length);
    expect(r.primaryKey).toBeNull();
  });

  it("steers towards SOCIAL_CARE / HEALTH_WELLBEING for a helping profile", () => {
    // q9 (aider des personnes), q2 (travailler avec des gens) = oui
    const r = scoreBoussole(QUESTIONS, { q9: "oui", q2: "oui", q3: "non" });
    expect(["SOCIAL_CARE", "HEALTH_WELLBEING"]).toContain(r.primaryKey);
    expect(r.totalScore).toBeGreaterThan(0);
  });

  it("steers towards TECHNICAL_MANUAL for a hands-on profile", () => {
    // q3 manuel oui, q8 éviter physique non, q2 préférer machines (non)
    const r = scoreBoussole(QUESTIONS, { q3: "oui", q8: "non", q2: "non" });
    expect(r.primaryKey).toBe("TECHNICAL_MANUAL");
  });

  it("steers towards ENTREPRENEURSHIP for an autonomy-seeking profile", () => {
    const r = scoreBoussole(QUESTIONS, { q14: "oui", q5: "non", q13: "oui" });
    expect(r.primaryKey).toBe("ENTREPRENEURSHIP");
  });

  it("is deterministic and orders the ranking by descending score", () => {
    const answers = { q4: "oui", q11: "oui", q8: "oui" };
    const a = scoreBoussole(QUESTIONS, answers);
    const b = scoreBoussole(QUESTIONS, answers);
    expect(a).toEqual(b);
    for (let i = 1; i < a.ranking.length; i++) {
      expect(a.ranking[i - 1].score).toBeGreaterThanOrEqual(a.ranking[i].score);
    }
    // shares sum to ~1 when there is signal
    const sum = a.ranking.reduce((s, x) => s + x.share, 0);
    expect(sum).toBeCloseTo(1, 5);
  });

  it("produces higher confidence for a sharply differentiated profile", () => {
    const sharp = scoreBoussole(QUESTIONS, {
      q9: "oui", q2: "oui", q6: "oui", q15: "oui",
    });
    const flat = scoreBoussole(QUESTIONS, { q1: "oui" });
    expect(sharp.confidence).toBeGreaterThanOrEqual(flat.confidence);
    expect(sharp.confidence).toBeGreaterThan(0);
  });
});
