import { describe, it, expect } from "vitest";
import { resolveStamps } from "../engine";
import { C47_RULES } from "../per-form/c47";

/// Comme le C1A, le C47 imprime son adresse sur deux lignes qui fusionnent
/// chacune deux informations. La saisie les garde séparées pour pouvoir les
/// hériter du C1 ; ces règles recomposent les lignes.
describe("Rules C47 — recomposition de l'adresse", () => {
  it("assemble les deux lignes imprimées", () => {
    const stamps = resolveStamps(
      { rue: "Rue de la Loi", numero: "16", codePostal: "1000", commune: "Bruxelles" },
      C47_RULES,
    );
    expect(stamps.get("Rue")).toBe("Rue de la Loi 16");
    expect(stamps.get("Commune et code postal")).toBe("1000 Bruxelles");
  });

  it("ignore les vides plutôt que de laisser un espace isolé", () => {
    const stamps = resolveStamps({ rue: "Rue de la Loi", commune: "Bruxelles" }, C47_RULES);
    expect(stamps.get("Rue")).toBe("Rue de la Loi");
    expect(stamps.get("Commune et code postal")).toBe("Bruxelles");
  });

  it("ne stampe rien quand une ligne n'a aucune source renseignée", () => {
    const stamps = resolveStamps({ rue: "", numero: "  " }, C47_RULES);
    expect(stamps.has("Rue")).toBe(false);
    expect(stamps.has("Commune et code postal")).toBe(false);
  });
});
