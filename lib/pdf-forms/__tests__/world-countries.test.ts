import { describe, expect, it } from "vitest";
import { WORLD_COUNTRIES, searchCountries, findCountryByName, flagEmoji } from "../world-countries";

describe("WORLD_COUNTRIES — intégrité de la liste", () => {
  it("contient un nombre raisonnable de pays (~195, sans doublons)", () => {
    expect(WORLD_COUNTRIES.length).toBeGreaterThanOrEqual(190);
    expect(WORLD_COUNTRIES.length).toBeLessThan(210);
  });

  it("chaque code est composé de 2 lettres majuscules uniques", () => {
    const codes = WORLD_COUNTRIES.map((c) => c.code);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("chaque nom est unique et non vide", () => {
    const names = WORLD_COUNTRIES.map((c) => c.name);
    for (const name of names) expect(name.trim().length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("searchCountries", () => {
  it("trouve Maroc en tapant un préfixe partiel, sans accent", () => {
    const results = searchCountries("maro");
    expect(results.map((c) => c.name)).toContain("Maroc");
  });

  it("priorise les préfixes avant les correspondances par inclusion", () => {
    const results = searchCountries("gu");
    expect(results[0].name.toLowerCase().startsWith("gu")).toBe(true);
  });

  it("est insensible aux accents et à la casse", () => {
    expect(searchCountries("BELGIQUE").map((c) => c.code)).toContain("BE");
    expect(searchCountries("cote d ivoire").map((c) => c.code)).toContain("CI");
  });

  it("renvoie un tableau vide pour une requête vide", () => {
    expect(searchCountries("")).toEqual([]);
  });

  it("respecte la limite passée", () => {
    expect(searchCountries("a", 3)).toHaveLength(3);
  });
});

describe("findCountryByName", () => {
  it("retrouve un pays par son nom exact, insensible à la casse/accents", () => {
    expect(findCountryByName("belgique")?.code).toBe("BE");
    expect(findCountryByName("MAROC")?.code).toBe("MA");
  });

  it("renvoie undefined pour un nom inconnu", () => {
    expect(findCountryByName("Narnia")).toBeUndefined();
  });
});

describe("flagEmoji", () => {
  it("calcule le bon drapeau à partir d'un code ISO connu", () => {
    expect(flagEmoji("BE")).toBe("🇧🇪");
    expect(flagEmoji("MA")).toBe("🇲🇦");
    expect(flagEmoji("FR")).toBe("🇫🇷");
  });

  it("renvoie une chaîne vide pour un code invalide", () => {
    expect(flagEmoji("")).toBe("");
    expect(flagEmoji("B")).toBe("");
    expect(flagEmoji("123")).toBe("");
  });
});
