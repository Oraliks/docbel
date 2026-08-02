import { describe, expect, it } from "vitest";
import {
  C1_REGIS_FIELDS,
  C1_REGIS_GROUPE_IDENTITE,
  C1_REGIS_QUESTIONS,
  applyC1RegisImprovements,
} from "../c1-regis-fields";

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

// ===========================================================================
// RÉALIGNEMENT DU 2026-08-02 (lot S14)
// ===========================================================================

describe("C1-Regis — ordre de lecture du papier", () => {
  const parId = new Map(C1_REGIS_FIELDS.map((f) => [f.id, f]));
  const ordre = (id: string) => parId.get(id)?.order ?? Number.NaN;

  it("déclare les SEPT lignes du tableau avant la première explication", () => {
    // C'était le défaut : chaque explication était déclarée à la suite de sa
    // ligne, alors que le papier les imprime toutes ensemble 220 points plus
    // bas. Les 14 écarts géométriques venaient de là.
    const derniereLigneDuTableau = Math.max(
      ordre("personne5Difference"),
      ordre("personne5C1"),
      ordre("personne5Registre"),
    );
    expect(ordre("nationaliteExplication")).toBeGreaterThan(derniereLigneDuTableau);
  });

  it("garde les explications dans l'ordre imprimé, nationalité d'abord", () => {
    const explications = [
      "nationaliteExplication",
      "adresseExplication",
      "personne1Explication",
      "personne2Explication",
      "personne3Explication",
      "personne4Explication",
      "personne5Explication",
    ].map(ordre);
    const trie = [...explications].sort((a, b) => a - b);
    expect(explications).toEqual(trie);
  });
});

describe("C1-Regis — parcours en étapes", () => {
  const fields = applyC1RegisImprovements([]);
  const parId = new Map(fields.map((f) => [f.id, f]));

  it("pose une question par ligne du tableau, plus la signature", () => {
    expect(C1_REGIS_QUESTIONS).toEqual([
      "nationaliteDifference",
      "adresseDifference",
      "personne1Difference",
      "personne2Difference",
      "personne3Difference",
      "personne4Difference",
      "personne5Difference",
      "signature",
    ]);
  });

  it("rattache les trois précisions d'une ligne à SA question", () => {
    // Sans ça, une ligne produirait quatre étapes dont trois vides quand la
    // réponse est « non » — soit vingt-huit écrans pour sept questions.
    for (const suffixe of ["C1", "Registre", "Explication"]) {
      expect(parId.get(`personne3${suffixe}`)?.stepGroup).toBe("personne3Difference");
    }
  });

  it("verse l'en-tête dans le groupe d'identité et le compte d'annexes sous la signature", () => {
    expect(parId.get("nom")?.stepGroup).toBe(C1_REGIS_GROUPE_IDENTITE);
    expect(parId.get("dateDA")?.stepGroup).toBe(C1_REGIS_GROUPE_IDENTITE);
    expect(parId.get("nombreAnnexesJointes")?.stepGroup).toBe("signature");
  });

  it("ne laisse aucun champ VISIBLE sans étape", () => {
    // Un champ sans groupe atterrit dans « Autres informations » de la dernière
    // étape : c'est un repli sûr, mais sur ce document il n'a aucune raison de
    // servir — les sept lignes et l'en-tête couvrent tout ce que le citoyen
    // remplit. Les deux cases administratives de la page 2 sont `hidden` : sans
    // groupe et sans écran, elles ne peuvent pas s'y égarer.
    const orphelins = fields.filter((f) => !f.stepGroup && !f.hidden).map((f) => f.id);
    expect(orphelins).toEqual([]);
  });
});

describe("C1-Regis — moules partagés", () => {
  it("propose oui/non dans les trois langues du site", () => {
    // Sa paire oui/non était une copie locale MONOLINGUE : « Oui »/« Non »
    // s'affichaient en français à un citoyen néerlandophone.
    const options = C1_REGIS_FIELDS.find((f) => f.id === "nationaliteDifference")?.options;
    expect(options?.[0].label.nl).toBe("Ja");
    expect(options?.[1].label.de).toBe("Nein");
  });
});
