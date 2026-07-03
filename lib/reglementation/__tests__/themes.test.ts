// lib/reglementation/__tests__/themes.test.ts
import { describe, it, expect } from "vitest";
import { deriveThemes, themeByKey } from "../themes";

describe("deriveThemes", () => {
  it("détecte le thème AGR", () => {
    const themes = deriveThemes(
      "Le travailleur à temps partiel bénéficiant de l'allocation de garantie de revenus…",
    );
    expect(themes.map((t) => t.key)).toContain("agr");
  });

  it("détecte plusieurs thèmes (insensible aux accents)", () => {
    const themes = deriveThemes(
      "En cas de sanction, le chomeur peut etre exclu ; la disponibilite reste requise.",
    );
    const keys = themes.map((t) => t.key);
    expect(keys).toContain("sanction");
  });

  it("texte neutre → aucun thème", () => {
    expect(deriveThemes("Pour l'application du présent arrêté.")).toEqual([]);
  });

  it("respecte la limite", () => {
    const themes = deriveThemes(
      "sanction exclusion garantie de revenus allocation d'insertion chômage temporaire dégressivité carte de contrôle cohabitant dispense",
      2,
    );
    expect(themes.length).toBeLessThanOrEqual(2);
  });

  it("themeByKey résout une clé connue", () => {
    expect(themeByKey("agr")?.label).toBe("AGR / temps partiel");
    expect(themeByKey("inconnu")).toBeUndefined();
  });
});
