import { describe, it, expect } from "vitest";
import { cleanOcrLabel, cleanDetectionsLabels } from "../label-cleanup";

describe("cleanOcrLabel", () => {
  it("returns empty string unchanged", () => {
    expect(cleanOcrLabel("")).toBe("");
  });

  it("strips trailing colons and underscores", () => {
    expect(cleanOcrLabel("Prénom :_____")).toBe("Prénom");
    expect(cleanOcrLabel("Date :")).toBe("Date");
    expect(cleanOcrLabel("Nom_____")).toBe("Nom");
  });

  it("strips (*) marker and underscore fillers", () => {
    expect(cleanOcrLabel("Numéro NISS (*) __ __ __")).toBe("Numéro NISS");
    expect(cleanOcrLabel("Adresse (*)")).toBe("Adresse");
  });

  it("strips standalone asterisks (mandatory markers)", () => {
    expect(cleanOcrLabel("Nom *")).toBe("Nom");
    expect(cleanOcrLabel("Nom *:")).toBe("Nom");
    expect(cleanOcrLabel("Date *: __/__/____")).toBe("Date");
  });

  it("strips dot runs (OCR ellipsis fillers)", () => {
    expect(cleanOcrLabel("Date.................")).toBe("Date");
    expect(cleanOcrLabel("Code postal.... 1000")).toBe("Code postal 1000");
  });

  it("preserves real parenthesized content", () => {
    expect(cleanOcrLabel("Nom (national)")).toBe("Nom (national)");
    expect(cleanOcrLabel("Numéro NISS (carte d'identité)")).toBe(
      "Numéro NISS (carte d'identité)"
    );
  });

  it("strips numbered footnote markers like (1) (12)", () => {
    expect(cleanOcrLabel("Salaire (1)")).toBe("Salaire");
    expect(cleanOcrLabel("Date (12)")).toBe("Date");
  });

  it("strips (N°) (No) (N0) variants", () => {
    expect(cleanOcrLabel("Numéro entreprise (N°)")).toBe("Numéro entreprise");
    expect(cleanOcrLabel("ID (No)")).toBe("ID");
  });

  it("strips slash-only parens", () => {
    expect(cleanOcrLabel("Email (/)")).toBe("Email");
  });

  it("collapses multiple spaces", () => {
    expect(cleanOcrLabel("Prénom    et    nom")).toBe("Prénom et nom");
  });

  it("strips pipe separators", () => {
    expect(cleanOcrLabel("Nom | Prénom")).toBe("Nom Prénom");
  });

  it("handles real-world ONEM-style labels", () => {
    expect(cleanOcrLabel("APRÈS LA DATE D'ENTRÉE EN VIGUEUR :")).toBe(
      "APRÈS LA DATE D'ENTRÉE EN VIGUEUR"
    );
    expect(cleanOcrLabel("Cachet dateur organisme de paiement")).toBe(
      "Cachet dateur organisme de paiement"
    );
    expect(cleanOcrLabel("À compléter par le travailleur")).toBe(
      "À compléter par le travailleur"
    );
  });

  it("leaves clean labels unchanged", () => {
    expect(cleanOcrLabel("Prénom et nom")).toBe("Prénom et nom");
    expect(cleanOcrLabel("Date de naissance")).toBe("Date de naissance");
  });

  it("handles labels that are pure noise", () => {
    // Tout retiré : devient vide
    expect(cleanOcrLabel("(*) ___ ___ ___")).toBe("");
    expect(cleanOcrLabel("******")).toBe("");
  });

  it("does not break labels containing arithmetic symbols", () => {
    // pas un astérisque "marker" — entouré de chiffres
    expect(cleanOcrLabel("3*4 = 12")).toBe("3*4 = 12");
  });
});

describe("cleanDetectionsLabels", () => {
  it("applies cleanup to all detections without mutating input", () => {
    const input = [
      { label: "Prénom :_____", x: 1 },
      { label: "Date *: __", x: 2 },
    ];
    const original = JSON.parse(JSON.stringify(input));
    const out = cleanDetectionsLabels(input);
    expect(out[0].label).toBe("Prénom");
    expect(out[1].label).toBe("Date");
    expect(out[0].x).toBe(1);
    // Input non muté
    expect(input).toEqual(original);
  });
});
