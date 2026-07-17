import { describe, expect, it } from "vitest";
import { C1_CHANGEMENT_RULES } from "../per-form/c1-changement";
import { getRulesForSlug } from "../registry";

describe("registre des bindings C1", () => {
  it.each(["c1-changement-situation"])(
    "%s partage les règles serveur du PDF C1 officiel",
    (slug) => {
      expect(getRulesForSlug(slug)).toBe(C1_CHANGEMENT_RULES);
    },
  );

  it("garde un repli neutre pour un formulaire inconnu", () => {
    expect(getRulesForSlug("inconnu")).toEqual([]);
  });
});
