import { describe, it, expect } from "vitest";
import { truncN, arrondiA, arrondiB, arrondiD, joursRound } from "../rounding";

describe("truncN", () => {
  it("tronque vers zéro sans bruit IEEE-754", () => {
    expect(truncN(17.61423, 4)).toBe(17.6142);
    expect(truncN(1450.23 / (4.3333 * 19), 4)).toBe(17.6142);
    expect(truncN(2.999999, 2)).toBe(2.99);
    expect(truncN(105.5349, 4)).toBe(105.5349);
  });
});

describe("arrondiA (troncature 4 décimales)", () => {
  it("équivaut à truncN(x,4)", () => {
    expect(arrondiA(0.123456)).toBe(0.1234);
  });
});

describe("arrondiB (arrondi commercial 2 décimales)", () => {
  it("arrondit vers le haut si 3ᵉ décimale ≥ 5", () => {
    expect(arrondiB(2900.4493)).toBe(2900.45); // 3ᵉ déc. = 9
    expect(arrondiB(2900.4549)).toBe(2900.45); // tronqué à 2900.454, 3ᵉ = 4
    expect(arrondiB(2900.4551)).toBe(2900.46); // 3ᵉ = 5
    expect(arrondiB(293.66)).toBe(293.66);
  });
});

describe("arrondiD (plafond au centime)", () => {
  it("monte d'un centime dès qu'il reste une fraction", () => {
    expect(arrondiD(1260.6849)).toBe(1260.69);
    expect(arrondiD(599.605)).toBe(599.61);
    expect(arrondiD(1260.68)).toBe(1260.68);
    expect(arrondiD(100.0001)).toBe(100.01);
    expect(arrondiD(100)).toBe(100);
  });
});

describe("joursRound (heures→jours, demi-jour)", () => {
  it("reproduit les exemples documentés de la formation", () => {
    expect(joursRound(1.2)).toBe(1); // 4,01×6/20,05 → 1 j. NI
    expect(joursRound(0.63)).toBe(0.5); // h.V → 0,5 VP
    expect(joursRound(1.0015)).toBe(1); // 2,17×6/13 → 1 j. NI
  });
  it("applique les seuils 0,25 / 0,75", () => {
    expect(joursRound(0.24)).toBe(0);
    expect(joursRound(0.25)).toBe(0.5);
    expect(joursRound(0.74)).toBe(0.5);
    expect(joursRound(0.75)).toBe(1);
    expect(joursRound(2.5)).toBe(2.5);
  });
});
