import { describe, expect, it } from "vitest";
import { C1B_FIELDS, applyC1BImprovements } from "../c1b-fields";

describe("C1B_FIELDS", () => {
  it("couvre l'identité, les 15 questions numérotées et la signature", () => {
    const ids = C1B_FIELDS.map((f) => f.id);
    expect(ids).toContain("niss");
    expect(ids).toContain("nom");
    expect(ids).toContain("pr_nom");
    expect(ids).toContain("droitPensionRetraiteComplete"); // Q1
    expect(ids).toContain("typePensionRetraiteComplete"); // Q2
    expect(ids).toContain("denominationPensionRetraiteComplete"); // Q3
    expect(ids).toContain("datePensionRetraiteComplete"); // Q4
    expect(ids).toContain("percoitPension"); // Q5
    expect(ids).toContain("typePensionPercue"); // Q6
    expect(ids).toContain("cumulPensionSurvieChomage"); // Q7 (cumul)
    expect(ids).toContain("cumulAnterieurMaladieChomagePrepension"); // Q7 (cumul antérieur)
    expect(ids).toContain("indemniteMaladieInvaliditeEtrangere"); // Q8
    expect(ids).toContain("montantIndemniteMaladieInvalidite"); // Q9
    expect(ids).toContain("indemniteAccidentTravailBelge"); // Q10
    expect(ids).toContain("natureIndemniteAccidentTravail"); // Q11
    expect(ids).toContain("indemniteAccidentTravailEtrangere"); // Q12
    expect(ids).toContain("congeSansSolde"); // Q13
    expect(ids).toContain("congeSansSoldeNomEmployeur"); // Q14
    expect(ids).toContain("congeSansSoldeAdresseEmployeur"); // Q14
    expect(ids).toContain("annexeDecisionsBelges"); // Q15
    expect(ids).toContain("signature");
  });

  it("les champs clés portent la bonne section", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("niss")?.section).toBe("identite");
    expect(byId.get("nom")?.section).toBe("identite");
    expect(byId.get("droitPensionRetraiteComplete")?.section).toBe("mes-revenus");
    expect(byId.get("percoitPension")?.section).toBe("mes-revenus");
    expect(byId.get("congeSansSolde")?.section).toBe("divers");
    expect(byId.get("annexeDecisionsBelges")?.section).toBe("annexes");
    expect(byId.get("signature")?.section).toBe("signature");
  });

  it("les questions oui/non pointent vers les vrais noms de widgets PDF (paires oui_N/non_N)", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("droitPensionRetraiteComplete")?.pdfFieldName).toBe("oui_2|non_2");
    expect(byId.get("percoitPension")?.pdfFieldName).toBe("oui|non");
    expect(byId.get("indemniteMaladieInvaliditeEtrangere")?.pdfFieldName).toBe("oui_3|non_5");
    expect(byId.get("indemniteAccidentTravailBelge")?.pdfFieldName).toBe("oui_5|non_7");
    expect(byId.get("indemniteAccidentTravailEtrangere")?.pdfFieldName).toBe("oui_6|non_8");
    expect(byId.get("congeSansSolde")?.pdfFieldName).toBe("oui_4|non_6");
  });

  it("le champ Q6 (type de pension perçue) fusionne les 4 checkboxes en un seul radio", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    const field = byId.get("typePensionPercue");
    expect(field?.pdfFieldName).toBe("une pens|une pens_2|une pens_3|une pens_4");
    expect(field?.options?.map((o) => o.value)).toEqual([
      "retraite-belge",
      "retraite-etrangere",
      "survie-etrangere",
      "survie-belge",
    ]);
  });

  it("le champ Q11 (nature de l'indemnité accident du travail) fusionne les 3 checkboxes i/i_2/i_3", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    const field = byId.get("natureIndemniteAccidentTravail");
    expect(field?.pdfFieldName).toBe("i|i_2|i_3");
    expect(field?.options?.length).toBe(3);
  });

  it("les sous-questions de Q1/Q6/Q7/Q13 sont masquées tant que la question parente n'est pas répondue", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("typePensionRetraiteComplete")?.visibleIf).toEqual({
      fieldId: "droitPensionRetraiteComplete",
      op: "equals",
      value: "oui",
    });
    expect(byId.get("cumulPensionSurvieChomage")?.visibleIf).toEqual({
      fieldId: "typePensionPercue",
      op: "equals",
      value: "survie-belge",
    });
    expect(byId.get("congeSansSoldeNomEmployeur")?.visibleIf).toEqual({
      fieldId: "congeSansSolde",
      op: "equals",
      value: "oui",
    });
  });

  it("les 4 annexes de la question 15 pointent chacune vers un widget checkbox distinct", () => {
    const byId = new Map(C1B_FIELDS.map((f) => [f.id, f]));
    expect(byId.get("annexeDecisionsBelges")?.pdfFieldName).toBe("déc");
    expect(byId.get("annexeDecisionsEtrangeres")?.pdfFieldName).toBe("déc_2");
    expect(byId.get("annexeCopiesPaiement")?.pdfFieldName).toBe("copies de paiement");
    expect(byId.get("annexeModele74")?.pdfFieldName).toBe(
      "une copie du modèle 74 ou 74bis PSS ou de la Déc"
    );
  });

  it("applyC1BImprovements() est idempotent (pas de doublon si ré-appliqué)", () => {
    const once = applyC1BImprovements([]);
    const twice = applyC1BImprovements(once);
    expect(twice.length).toBe(once.length);
    const ids = twice.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("applyC1BImprovements() retire tous les champs auto-inférés bruts et ne laisse aucun doublon", () => {
    // Reproduit un sous-ensemble représentatif de l'inférence automatique
    // (libellés laids typiques), y compris des champs texte génériques qui
    // seraient sinon en doublon avec leur version enrichie (ex. "undefined").
    const rawInferred = [
      { id: "oui", pdfFieldName: "oui", type: "checkbox" as const, required: false, label: { fr: "oui" } },
      { id: "non", pdfFieldName: "non", type: "checkbox" as const, required: false, label: { fr: "non" } },
      { id: "undefined", pdfFieldName: "undefined", type: "text" as const, required: false, label: { fr: "undefined" } },
      { id: "texte48", pdfFieldName: "Texte48", type: "text" as const, required: false, label: { fr: "Texte48" } },
      { id: "aujourd_hui", pdfFieldName: "AUJOURD'HUI", type: "text" as const, required: false, label: { fr: "AUJOURD'HUI" } },
    ];
    const improved = applyC1BImprovements(rawInferred);
    // Aucun des champs bruts d'origine ne doit survivre tel quel.
    for (const raw of rawInferred) {
      const survivor = improved.find((f) => f.id === raw.id);
      // Si un champ du même id existe encore, il doit être la version enrichie
      // (label différent de l'auto-inférence), jamais le doublon brut.
      if (survivor) {
        expect(survivor.label.fr).not.toBe(raw.label.fr);
      }
    }
    // Pas de doublon de pdfFieldName parmi les champs simples (hors radio pipe).
    const simpleNames = improved
      .map((f) => f.pdfFieldName)
      .filter((n) => n && !n.includes("|"));
    expect(new Set(simpleNames).size).toBe(simpleNames.length);
  });

  it("le nombre de champs après application sur le dump brut correspond au schéma enrichi attendu (40 champs)", () => {
    const improved = applyC1BImprovements([]);
    expect(improved.length).toBe(C1B_FIELDS.length);
    expect(improved.length).toBe(40);
  });
});
