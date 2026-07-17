import { describe, expect, it } from "vitest";
import { shouldFlattenGeneratedPdf } from "../flatten-policy";

describe("shouldFlattenGeneratedPdf", () => {
  it.each(["c1-changement-situation"])(
    "préserve l'AcroForm de %s pour éviter les XRef invalides",
    (slug) => {
      expect(shouldFlattenGeneratedPdf(slug)).toBe(false);
    },
  );

  it.each(["c1a", "c1b", "c1c", "c46", "c47", "autre-formulaire"])(
    "conserve l'aplatissement habituel de %s",
    (slug) => {
      expect(shouldFlattenGeneratedPdf(slug)).toBe(true);
    },
  );
});
