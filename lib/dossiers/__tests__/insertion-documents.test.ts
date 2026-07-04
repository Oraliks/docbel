import { describe, expect, it } from "vitest";

import { allocationsInsertion } from "../allocations-insertion";
import { selectDocuments, type DossierAnswers } from "../types";

/** Slugs des documents applicables pour un jeu de réponses. */
function slugsFor(answers: DossierAnswers): string[] {
  return selectDocuments(allocationsInsertion, answers).map((d) => d.slug);
}

// Documents TOUJOURS présents (sans includeWhen).
const BASELINE = [
  "c109-36-demande",
  "c1-insertion",
  "attestation-inscription-a15",
  "evaluations-positives-sip",
];

describe("allocations-insertion — arbre de documents conditionnel", () => {
  it("réponses vides → seulement les documents de base", () => {
    expect(slugsFor({}).sort()).toEqual([...BASELINE].sort());
  });

  it("preuve d'études : UNE seule branche selon parcoursEtudes", () => {
    // Secondaire belge → CERTIFICAT + DIPLÔME (deux formulaires distincts).
    const sec = slugsFor({ parcoursEtudes: "secondaire-belge" });
    expect(sec).toContain("c109-36-certificat");
    expect(sec).toContain("c109-36-diplome");
    expect(sec).not.toContain("c109-36-etranger");
    expect(sec).not.toContain("c109-36-annexe");
    expect(sec).not.toContain("copie-diplome-superieur");

    // Supérieur belge → copie du diplôme (dispense), pas de formulaire école.
    const sup = slugsFor({ parcoursEtudes: "superieur-belge" });
    expect(sup).toContain("copie-diplome-superieur");
    expect(sup).not.toContain("c109-36-certificat");
    expect(sup).not.toContain("c109-36-diplome");

    // Étranger → ÉTRANGER uniquement.
    const etr = slugsFor({ parcoursEtudes: "etranger" });
    expect(etr).toContain("c109-36-etranger");
    expect(etr).not.toContain("c109-36-annexe");

    // Autre → ANNEXE uniquement.
    const autre = slugsFor({ parcoursEtudes: "autre" });
    expect(autre).toContain("c109-36-annexe");
    expect(autre).not.toContain("c109-36-etranger");
  });

  it("moins de 21 ans → ajoute C109/36-CONDITION21ANS", () => {
    expect(slugsFor({ age: "moins-18" })).toContain("c109-36-condition21ans");
    expect(slugsFor({ age: "18-20" })).toContain("c109-36-condition21ans");
    expect(slugsFor({ age: "21-24" })).not.toContain("c109-36-condition21ans");
    expect(slugsFor({ age: "25-plus" })).not.toContain("c109-36-condition21ans");
  });

  it("a travaillé → ajoute le C4 (réduction du SIP)", () => {
    expect(slugsFor({ aTravaille: "true" })).toContain("c4-reduction-sip");
    expect(slugsFor({ aTravaille: "false" })).not.toContain("c4-reduction-sip");
    expect(slugsFor({})).not.toContain("c4-reduction-sip");
  });

  it("cas complet (secondaire belge, 20 ans, a travaillé) → checklist cohérente", () => {
    const s = slugsFor({
      parcoursEtudes: "secondaire-belge",
      age: "18-20",
      aTravaille: "true",
    });
    expect(s.sort()).toEqual(
      [
        ...BASELINE,
        "c109-36-certificat",
        "c109-36-diplome",
        "c109-36-condition21ans",
        "c4-reduction-sip",
      ].sort(),
    );
  });

  it("les pièces tierces ne sont pas remplissables (fields vides, responsibility ≠ user)", () => {
    for (const doc of allocationsInsertion.documents) {
      if (doc.responsibility && doc.responsibility !== "user") {
        expect(doc.fields).toHaveLength(0);
      }
    }
  });

  it("seul le C1 reste préremplissable (PDF présent + champs)", () => {
    const fillable = allocationsInsertion.documents.filter(
      (d) => (!d.responsibility || d.responsibility === "user") && d.fields.length > 0,
    );
    expect(fillable.map((d) => d.slug)).toEqual(["c1-insertion"]);
  });
});
