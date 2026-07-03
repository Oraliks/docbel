// lib/reglementation/__tests__/reform.test.ts
import { describe, it, expect } from "vitest";
import { isReformArticle, extractReformPassages } from "../reform";

describe("isReformArticle", () => {
  it("détecte le marqueur de réforme", () => {
    expect(isReformArticle("… (Loi-programme 18.7.2025 - MB 29.7 - EV 1.3.2026)")).toBe(true);
    expect(isReformArticle("texte ordinaire")).toBe(false);
  });
});

describe("extractReformPassages", () => {
  it("extrait le passage inséré, ref d'acte retirée", () => {
    const txt =
      "Texte de base. [l'article 36, § 1er, alinéa 1er, 2°, c) (Loi-programme 18.7.2025 - MB 29.7 - EV 1.3.2026)] suite.";
    const p = extractReformPassages(txt);
    expect(p).toHaveLength(1);
    expect(p[0]).toBe("l'article 36, § 1er, alinéa 1er, 2°, c)");
    expect(p[0]).not.toContain("Loi-programme");
  });

  it("gère une abrogation par la réforme", () => {
    const p = extractReformPassages("[Abrogé (Loi-programme 18.7.2025 - MB 29.7 - EV 1.3.2026)]");
    expect(p[0]).toBe("Abrogé");
  });

  it("déduplique et ignore les crochets sans le marqueur", () => {
    const txt =
      "[modif A (Loi-programme 18.7.2025 - EV 1.3.2026)] [autre (AR 30.7.2022)] [modif A (Loi-programme 18.7.2025 - EV 1.3.2026)]";
    const p = extractReformPassages(txt);
    expect(p).toEqual(["modif A"]);
  });

  it("texte sans réforme → []", () => {
    expect(extractReformPassages("Rien ici.")).toEqual([]);
  });
});
