import { describe, expect, it } from "vitest";
import { resolveOnSelectSet } from "../field-side-effects";

describe("resolveOnSelectSet", () => {
  const field = {
    id: "cohabiteType",
    onSelectSet: {
      whenValue: "colocation",
      set: [
        { fieldId: "statutFamilial", value: "isole" },
        { fieldId: "habiteEnColocation", value: "oui" },
      ],
    },
  };

  it("renvoie les couples à écrire quand la valeur matche whenValue", () => {
    expect(resolveOnSelectSet(field, "colocation")).toEqual([
      { fieldId: "statutFamilial", value: "isole" },
      { fieldId: "habiteEnColocation", value: "oui" },
    ]);
  });

  it("renvoie null quand la valeur ne matche pas whenValue", () => {
    expect(resolveOnSelectSet(field, "menage-commun")).toBeNull();
  });

  it("renvoie null quand le champ n'a pas d'onSelectSet", () => {
    expect(resolveOnSelectSet({ id: "autre" }, "colocation")).toBeNull();
  });
});
