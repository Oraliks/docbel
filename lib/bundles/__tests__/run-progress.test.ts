import { describe, it, expect } from "vitest";
import { bundleRunHasProgress } from "../run-progress";

describe("bundleRunHasProgress", () => {
  it("vide sur tous les champs → false", () => {
    expect(
      bundleRunHasProgress({ completedTemplateIds: [], eligibilityAnswers: {}, payloads: {} }),
    ).toBe(false);
    expect(
      bundleRunHasProgress({ completedTemplateIds: null, eligibilityAnswers: null, payloads: null }),
    ).toBe(false);
  });
  it("un document complété → true", () => {
    expect(
      bundleRunHasProgress({ completedTemplateIds: ["a"], eligibilityAnswers: {}, payloads: {} }),
    ).toBe(true);
  });
  it("une réponse de pré-qualif → true", () => {
    expect(
      bundleRunHasProgress({ completedTemplateIds: [], eligibilityAnswers: { q1: "oui" }, payloads: {} }),
    ).toBe(true);
  });
  it("un payload → true", () => {
    expect(
      bundleRunHasProgress({ completedTemplateIds: [], eligibilityAnswers: {}, payloads: { form1: { niss: "x" } } }),
    ).toBe(true);
  });
});
