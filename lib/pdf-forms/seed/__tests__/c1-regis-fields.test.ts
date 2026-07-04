import { describe, expect, it } from "vitest";
import { C1_REGIS_FIELDS, applyC1RegisImprovements } from "../c1-regis-fields";

describe("C1_REGIS_FIELDS", () => {
  it("couvre l'identité, les 2 lignes nationalité/adresse et les 5 lignes personne", () => {
    const ids = C1_REGIS_FIELDS.map((f) => f.id);
    expect(ids).toContain("nom");
    expect(ids).toContain("prenom");
    expect(ids).toContain("nationaliteDifference");
    expect(ids).toContain("adresseDifference");
    for (let n = 1; n <= 5; n++) {
      expect(ids).toContain(`personne${n}Difference`);
      expect(ids).toContain(`personne${n}C1`);
      expect(ids).toContain(`personne${n}Registre`);
      expect(ids).toContain(`personne${n}Explication`);
    }
  });

  it("les 5 checkboxes 'différence' pointent vers les vrais noms de widgets PDF (oui_3..oui_7)", () => {
    const byId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("personne1Difference")?.pdfFieldName).toBe("oui_3|non_3");
    expect(byId.get("personne2Difference")?.pdfFieldName).toBe("oui_4|non_4");
    expect(byId.get("personne3Difference")?.pdfFieldName).toBe("oui_5|non_5");
    expect(byId.get("personne4Difference")?.pdfFieldName).toBe("oui_6|non_6");
    expect(byId.get("personne5Difference")?.pdfFieldName).toBe("oui_7|non_7");
  });

  it("le champ explication de la 5e personne pointe vers le widget bare 'PERSONNE' (nommage irrégulier du PDF officiel)", () => {
    const byId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("personne5Explication")?.pdfFieldName).toBe("PERSONNE");
    expect(byId.get("personne1Explication")?.pdfFieldName).toBe("PERSONNE 1");
  });

  it("l'aide du champ explication mentionne le code FN4 pour la colocation", () => {
    const byId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("personne1Explication")?.help?.fr).toMatch(/FN4/);
  });

  it("les champs de la grille 2 (indication C1 / registres) sont masqués tant que 'différence' n'est pas oui", () => {
    const byId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("personne1C1")?.visibleIf).toEqual({
      fieldId: "personne1Difference",
      op: "equals",
      value: "oui",
    });
  });

  it("applyC1RegisImprovements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC1RegisImprovements([]);
    const twice = applyC1RegisImprovements(once);
    expect(twice.length).toBe(once.length);
  });

  it("applyC1RegisImprovements() masque les 2 cases administratives de la page 2 (hors périmètre citoyen)", () => {
    const fields = applyC1RegisImprovements([]);
    const hidden = fields.filter((f) => f.hidden);
    expect(hidden.length).toBe(2);
  });
});
