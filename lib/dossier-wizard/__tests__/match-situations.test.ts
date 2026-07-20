import { describe, it, expect } from "vitest";
import { matchSituations } from "../match-situations";

const items = [
  { value: "perte-emploi", text: "J'ai perdu mon emploi licenciement chômage" },
  { value: "insertion", text: "Je cherche un premier emploi insertion études" },
  { value: "sante", text: "Je suis en incapacité de travail maladie santé" },
];

describe("matchSituations", () => {
  it("requête vide → aucune situation", () => {
    expect(matchSituations("", items)).toEqual([]);
    expect(matchSituations("   ", items)).toEqual([]);
  });
  it("matche label + mots-clés, insensible à la casse", () => {
    expect(matchSituations("EMPLOI", items)).toEqual(["perte-emploi", "insertion"]);
  });
  it("insensible aux accents", () => {
    expect(matchSituations("sante", items)).toEqual(["sante"]);
    expect(matchSituations("santé", items)).toEqual(["sante"]);
  });
  it("aucun match → tableau vide (déclenche le secours IA)", () => {
    expect(matchSituations("zzzznexistepas", items)).toEqual([]);
  });
});
