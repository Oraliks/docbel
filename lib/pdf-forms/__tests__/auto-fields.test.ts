import { describe, it, expect } from "vitest";
import { isSignatureField, isCreationDateField, isAutoField } from "../auto-fields";

describe("isSignatureField", () => {
  it("type signature explicite", () => {
    expect(isSignatureField({ id: "x", type: "signature" })).toBe(true);
  });
  it("type text mais libellé 'Signature' (cas C32)", () => {
    expect(isSignatureField({ id: "sig", type: "text", label: { fr: "Signature" } })).toBe(true);
  });
  it("libellé NL handtekening", () => {
    expect(isSignatureField({ id: "x", type: "text", label: { nl: "Handtekening" } })).toBe(true);
  });
  it("id 'Signature5' (ex. mockup)", () => {
    expect(isSignatureField({ id: "Signature5", type: "text" })).toBe(true);
  });
  it("ne déclenche pas sur un libellé non-signature", () => {
    expect(isSignatureField({ id: "remarks", type: "text", label: { fr: "Remarques" } })).toBe(false);
  });
});

describe("isCreationDateField", () => {
  it("prefillFrom system.today explicite", () => {
    expect(isCreationDateField({ id: "x", type: "date", prefillFrom: "system.today" })).toBe(true);
  });
  it("libellé 'Date de création' (cas C32)", () => {
    expect(isCreationDateField({ id: "d", type: "date", label: { fr: "Date de création" } })).toBe(true);
  });
  it("libellé 'Date de génération'", () => {
    expect(isCreationDateField({ id: "d", type: "date", label: { fr: "Date de génération" } })).toBe(true);
  });
  it("libellé NL Aanmaakdatum", () => {
    expect(isCreationDateField({ id: "d", type: "date", label: { nl: "Aanmaakdatum" } })).toBe(true);
  });
  it("ne déclenche pas sur 'Date de naissance'", () => {
    expect(isCreationDateField({ id: "n", type: "date", label: { fr: "Date de naissance" } })).toBe(false);
  });
});

describe("isAutoField", () => {
  it("vrai pour signature ou date de création, faux sinon", () => {
    expect(isAutoField({ id: "s", type: "text", label: { fr: "Signature" } })).toBe(true);
    expect(isAutoField({ id: "d", type: "date", label: { fr: "Date de création" } })).toBe(true);
    expect(isAutoField({ id: "n", type: "text", label: { fr: "Nom" } })).toBe(false);
  });

  it("vrai pour un champ marqué autoAnswered (ex. motifIntroduction restreint du C1)", () => {
    expect(isAutoField({ id: "motifIntroduction", type: "radio", autoAnswered: true })).toBe(true);
  });

  it("autoAnswered absent/false ne déclenche rien seul", () => {
    expect(isAutoField({ id: "x", type: "radio", label: { fr: "Motif" } })).toBe(false);
    expect(isAutoField({ id: "x", type: "radio", label: { fr: "Motif" }, autoAnswered: false })).toBe(false);
  });
});
