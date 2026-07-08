import { describe, it, expect } from "vitest";
import { resolveStamps } from "../engine";
import {
  ibanBelgianSplit,
  ibanForeignRouting,
  horsEeeTripleNon,
  dateHeaderFallback,
} from "../macros";

describe("macro : ibanBelgianSplit", () => {
  const rule = ibanBelgianSplit({
    sourceField: "iban",
    widgets: { checkDigits: "B E", part1: "u_11", part2: "u_12", part3: "u_13" },
  });

  it("split un IBAN belge complet en 4 groupes", () => {
    const stamps = resolveStamps({ iban: "BE68 5390 0754 7034" }, [rule]);
    expect(stamps.get("B E")).toBe("68");
    expect(stamps.get("u_11")).toBe("5390");
    expect(stamps.get("u_12")).toBe("0754");
    expect(stamps.get("u_13")).toBe("7034");
  });

  it("IBAN étranger → aucun stamp (whenFn falsy)", () => {
    const stamps = resolveStamps({ iban: "FR76 3000 6000 0112 3456 7890 189" }, [rule]);
    expect(stamps.size).toBe(0);
  });

  it("IBAN belge incomplet (<14 chiffres) → aucun stamp", () => {
    const stamps = resolveStamps({ iban: "BE68 5390" }, [rule]);
    expect(stamps.size).toBe(0);
  });

  it("declaredWidgets liste les 4 cibles (pour mapping-report)", () => {
    expect(rule.declaredWidgets).toEqual(["B E", "u_11", "u_12", "u_13"]);
  });
});

describe("macro : ibanForeignRouting", () => {
  const rule = ibanForeignRouting({ sourceField: "iban", widget: "SEPA étranger" });

  it("IBAN non-BE → stampe la valeur brute sur le widget SEPA", () => {
    const stamps = resolveStamps({ iban: "FR76 3000 6000" }, [rule]);
    expect(stamps.get("SEPA étranger")).toBe("FR76 3000 6000");
  });

  it("IBAN BE → aucun stamp", () => {
    const stamps = resolveStamps({ iban: "BE68 5390 0754 7034" }, [rule]);
    expect(stamps.size).toBe(0);
  });

  it("IBAN vide → aucun stamp", () => {
    expect(resolveStamps({ iban: "" }, [rule]).size).toBe(0);
  });
});

describe("macro : horsEeeTripleNon", () => {
  const rule = horsEeeTripleNon({
    sourceField: "horsEEE",
    widgets: { nonRefugie: "n17", nonApatride: "n18", nonHorsEee: "n19" },
  });

  it('sourceField = "non" → coche les 3 widgets', () => {
    const stamps = resolveStamps({ horsEEE: "non" }, [rule]);
    expect(stamps.get("n17")).toBe(true);
    expect(stamps.get("n18")).toBe(true);
    expect(stamps.get("n19")).toBe(true);
  });

  it('sourceField = "oui" → aucun stamp', () => {
    expect(resolveStamps({ horsEEE: "oui" }, [rule]).size).toBe(0);
  });

  it("sourceField absent → aucun stamp", () => {
    expect(resolveStamps({}, [rule]).size).toBe(0);
  });

  it("matchValue custom (ex. true booléen)", () => {
    const boolRule = horsEeeTripleNon({
      sourceField: "isEEE",
      matchValue: true,
      widgets: { nonRefugie: "a", nonApatride: "b", nonHorsEee: "c" },
    });
    expect(resolveStamps({ isEEE: true }, [boolRule]).size).toBe(3);
    expect(resolveStamps({ isEEE: false }, [boolRule]).size).toBe(0);
  });
});

describe("macro : dateHeaderFallback", () => {
  const rule = dateHeaderFallback({
    widget: "Date de DA",
    sources: ["dateMod", "dateDem"],
  });

  it("première source non vide gagne", () => {
    const stamps = resolveStamps(
      { dateMod: "2026-06-15", dateDem: "2026-07-08" },
      [rule]
    );
    expect(stamps.get("Date de DA")).toBe("15/06/2026");
  });

  it("fallback sur la 2ᵉ source si la 1ʳᵉ est vide", () => {
    const stamps = resolveStamps({ dateMod: "", dateDem: "2026-07-08" }, [rule]);
    expect(stamps.get("Date de DA")).toBe("08/07/2026");
  });

  it("toutes sources vides → aucun stamp", () => {
    expect(resolveStamps({ dateMod: "", dateDem: "" }, [rule]).size).toBe(0);
    expect(resolveStamps({}, [rule]).size).toBe(0);
  });

  it("format FR appliqué (ISO → DD/MM/YYYY), autre → tel quel", () => {
    expect(
      resolveStamps({ dateMod: "2026-12-31" }, [rule]).get("Date de DA")
    ).toBe("31/12/2026");
    expect(
      resolveStamps({ dateMod: "31/12/2026" }, [rule]).get("Date de DA")
    ).toBe("31/12/2026");
  });
});
