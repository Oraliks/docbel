import { describe, expect, it } from "vitest";
import {
  parseStreetSuggestions,
  prioritizeByPostalCode,
  type RawLookupResult,
} from "../street-suggestions";

describe("parseStreetSuggestions", () => {
  it("extrait rue/code postal/commune depuis metadata", () => {
    const raw: RawLookupResult[] = [
      { id: "1", labelFr: "Rue Neuve", metadata: { "Code postal": "1000", Commune: "Bruxelles" } },
    ];
    expect(parseStreetSuggestions(raw)).toEqual([
      { id: "1", street: "Rue Neuve", postalCode: "1000", commune: "Bruxelles" },
    ]);
  });

  it("ignore une entrée sans code postal ou sans commune dans metadata (suggestion inexploitable)", () => {
    const raw: RawLookupResult[] = [
      { id: "1", labelFr: "Rue Sans Code Postal", metadata: { Commune: "Bruxelles" } },
      { id: "2", labelFr: "Rue Sans Commune", metadata: { "Code postal": "1000" } },
      { id: "3", labelFr: "Rue Sans Metadata", metadata: null },
    ];
    expect(parseStreetSuggestions(raw)).toEqual([]);
  });
});

describe("prioritizeByPostalCode", () => {
  const suggestions = [
    { id: "a", street: "Rue Neuve", postalCode: "4000", commune: "Liège" },
    { id: "b", street: "Rue Neuve", postalCode: "1000", commune: "Bruxelles" },
    { id: "c", street: "Rue Neuve", postalCode: "1080", commune: "Molenbeek-Saint-Jean" },
  ];

  it("fait remonter les correspondances de code postal en tête, sans en retirer aucune", () => {
    const result = prioritizeByPostalCode(suggestions, "1080");
    expect(result.map((s) => s.id)).toEqual(["c", "a", "b"]);
  });

  it("préserve l'ordre d'origine si aucun code postal n'est fourni", () => {
    expect(prioritizeByPostalCode(suggestions, undefined)).toEqual(suggestions);
  });

  it("préserve l'ordre d'origine si aucune correspondance (jamais de retrait)", () => {
    const result = prioritizeByPostalCode(suggestions, "9999");
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
