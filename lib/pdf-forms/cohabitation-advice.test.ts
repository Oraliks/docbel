import { describe, expect, it } from "vitest";
import { getCohabitationAdvice } from "./cohabitation-advice";

describe("getCohabitationAdvice", () => {
  it("conseille FAC pour un seul cohabitant déclaré sans lien", () => {
    expect(getCohabitationAdvice([{ lien: "aucun-lien" }])).toBe("consider-fac");
  });

  it("ne conseille pas FAC pour un conjoint, partenaire ou plusieurs personnes", () => {
    expect(getCohabitationAdvice([{ lien: "epoux" }])).toBeNull();
    expect(getCohabitationAdvice([{ lien: "partenaire" }])).toBeNull();
    expect(getCohabitationAdvice([{ lien: "aucun-lien" }, { lien: "enfant" }])).toBeNull();
  });
});
