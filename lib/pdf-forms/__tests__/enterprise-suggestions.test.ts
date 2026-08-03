import { describe, expect, it } from "vitest";
import { formatEnterpriseAddress, parseEnterpriseSuggestions } from "../enterprise-suggestions";
import type { KboLookupResult } from "@/lib/be-companies/kbo-lookup";

function result(p: Partial<KboLookupResult> = {}): KboLookupResult {
  return {
    enterpriseNumber: "0123456749",
    status: "AC",
    juridicalForm: null,
    startDate: null,
    names: { default: "Cantillon SPRL", fr: "Cantillon SPRL" },
    registeredOffice: {
      street: "Rue Gheude",
      houseNumber: "56",
      zipcode: "1070",
      city: "Anderlecht",
      country: "Belgique",
    },
    mainNaceCode: null,
    ...p,
  };
}

describe("formatEnterpriseAddress", () => {
  it("compose rue + numéro, CP + ville", () => {
    expect(formatEnterpriseAddress(result().registeredOffice)).toBe(
      "Rue Gheude 56, 1070 Anderlecht",
    );
  });

  it("ajoute la boîte si présente", () => {
    expect(
      formatEnterpriseAddress({
        street: "Avenue Louise",
        houseNumber: "1",
        box: "3",
        zipcode: "1050",
        city: "Bruxelles",
      }),
    ).toBe("Avenue Louise 1, boîte 3, 1050 Bruxelles");
  });

  it("rue/CP/ville manquants → chaîne vide (pas d'adresse tronquée trompeuse)", () => {
    expect(formatEnterpriseAddress(undefined)).toBe("");
    expect(formatEnterpriseAddress({ city: "Bruxelles" })).toBe("");
  });
});

describe("parseEnterpriseSuggestions", () => {
  it("mappe nom + adresse composée + numéro BCE", () => {
    const out = parseEnterpriseSuggestions([result()]);
    expect(out).toEqual([
      { bceNumber: "0123456749", name: "Cantillon SPRL", address: "Rue Gheude 56, 1070 Anderlecht" },
    ]);
  });

  it("dénomination absente → entreprise ignorée", () => {
    const out = parseEnterpriseSuggestions([result({ names: { default: "" } })]);
    expect(out).toEqual([]);
  });

  it("pas d'adresse de siège → suggestion gardée avec address vide", () => {
    const out = parseEnterpriseSuggestions([result({ registeredOffice: undefined })]);
    expect(out).toEqual([{ bceNumber: "0123456749", name: "Cantillon SPRL", address: "" }]);
  });
});
