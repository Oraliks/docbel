import { describe, it, expect } from "vitest";
import { resolveStamps } from "../engine";
import { C1A_RULES } from "../per-form/c1a";

/// Le C1A fusionne deux informations par widget d'adresse. La saisie les garde
/// séparées (une clé canonique = une valeur, pour hériter du C1) ; ces règles
/// recomposent les lignes imprimées.
describe("Rules C1A — recomposition de l'en-tête d'adresse", () => {
  it("assemble « rue + numéro » et « code postal + commune »", () => {
    const stamps = resolveStamps(
      { rue: "Rue de la Loi", numero: "16", codePostal: "1000", commune: "Bruxelles" },
      C1A_RULES,
    );
    expect(stamps.get("Rue")).toBe("Rue de la Loi 16");
    expect(stamps.get("Code postal et commune")).toBe("1000 Bruxelles");
  });

  it("ignore les vides plutôt que de laisser un espace isolé", () => {
    const stamps = resolveStamps({ rue: "Rue de la Loi", codePostal: "1000" }, C1A_RULES);
    expect(stamps.get("Rue")).toBe("Rue de la Loi");
    expect(stamps.get("Code postal et commune")).toBe("1000");
  });

  it("ne stampe rien quand les deux sources d'une ligne sont vides", () => {
    const stamps = resolveStamps({ rue: "", numero: "   ", codePostal: "", commune: "" }, C1A_RULES);
    expect(stamps.has("Rue")).toBe(false);
    expect(stamps.has("Code postal et commune")).toBe(false);
  });

  it("tolère un payload sans aucune de ces clés", () => {
    expect(resolveStamps({ autreChose: "x" }, C1A_RULES).size).toBe(0);
  });
});
