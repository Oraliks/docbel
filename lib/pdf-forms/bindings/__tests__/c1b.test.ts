import { describe, it, expect } from "vitest";
import { resolveStamps } from "../engine";
import { C1B_RULES } from "../per-form/c1b";

/// L'en-tête de la page 2 du C1B (« Suite C1B — NISS … Nom … ») duplique le
/// nom saisi page 1. C'était un champ `readOnly` prérempli depuis le profil :
/// il restait VIDE pour qui saisissait son nom directement dans le C1B, sans
/// possibilité de corriger. Une règle le recopie à la génération.
describe("Rules C1B — en-tête de la page 2", () => {
  it("recopie le nom de la page 1", () => {
    expect(resolveStamps({ nom: "Dupont" }, C1B_RULES).get("Nom")).toBe("Dupont");
  });

  it("ne stampe rien quand le nom est vide", () => {
    expect(resolveStamps({ nom: "" }, C1B_RULES).has("Nom")).toBe(false);
    expect(resolveStamps({}, C1B_RULES).has("Nom")).toBe(false);
  });
});
