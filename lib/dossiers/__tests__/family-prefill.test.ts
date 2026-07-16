import { describe, expect, it } from "vitest";
import { familyAnswersToC1Prefill } from "../family-prefill";

describe("familyAnswersToC1Prefill", () => {
  it("préremplit un conjoint marié comme ménage commun sans C1P", () => {
    expect(familyAnswersToC1Prefill({ famille_situation: "conjoint" })).toEqual({
      statutFamilial: "cohabite",
      cohabiteType: "menage-commun",
    });
  });

  it("transforme aucun lien + colocation en isolé et REGIS", () => {
    expect(familyAnswersToC1Prefill({
      famille_situation: "aucun-lien",
      famille_colocation: "oui",
    })).toEqual({
      statutFamilial: "isole",
      cohabiteType: "colocation",
      habiteEnColocation: "oui",
    });
  });
});
