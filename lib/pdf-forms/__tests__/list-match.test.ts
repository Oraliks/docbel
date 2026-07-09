import { describe, expect, it } from "vitest";
import { findListMatchErrors } from "../list-match";

const street = {
  id: "adresse_rue",
  requireListMatch: { escapeFieldId: "adresse_rue_hors_liste" },
};

describe("findListMatchErrors", () => {
  it("signale une rue tapée non vérifiée et sans échappatoire", () => {
    const errs = findListMatchErrors([street], { adresse_rue: "test" }, new Set(), "fr");
    expect(errs.adresse_rue).toBeTruthy();
  });

  it("accepte une rue vérifiée (choisie dans la liste)", () => {
    const errs = findListMatchErrors([street], { adresse_rue: "Rue de la Loi" }, new Set(["adresse_rue"]), "fr");
    expect(errs.adresse_rue).toBeUndefined();
  });

  it("accepte n'importe quelle rue quand la case d'échappement est cochée", () => {
    const errs = findListMatchErrors(
      [street],
      { adresse_rue: "Rue inexistante", adresse_rue_hors_liste: true },
      new Set(),
      "fr"
    );
    expect(errs.adresse_rue).toBeUndefined();
  });

  it("ignore un champ vide (le requis est géré ailleurs)", () => {
    expect(findListMatchErrors([street], { adresse_rue: "" }, new Set(), "fr")).toEqual({});
    expect(findListMatchErrors([street], {}, new Set(), "fr")).toEqual({});
  });

  it("ignore un champ masqué par visibleIf", () => {
    const gated = { ...street, visibleIf: { fieldId: "flag", op: "equals" as const, value: "on" } };
    const errs = findListMatchErrors([gated], { flag: "off", adresse_rue: "test" }, new Set(), "fr");
    expect(errs.adresse_rue).toBeUndefined();
  });

  it("ignore un champ sans requireListMatch", () => {
    expect(findListMatchErrors([{ id: "x" }], { x: "n'importe quoi" }, new Set(), "fr")).toEqual({});
  });
});
