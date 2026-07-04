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

  it("le CERTIFICAT et l'ANNEXE (abrogés au 01/03/2026) n'existent plus", () => {
    const slugs = allocationsInsertion.documents.map((d) => d.slug);
    expect(slugs).not.toContain("c109-36-certificat");
    expect(slugs).not.toContain("c109-36-annexe");
  });

  it("preuve d'études : UNE seule branche selon parcoursEtudes", () => {
    // Secondaire belge → DIPLÔME (remplace le CERTIFICAT depuis 01/03/2026).
    const sec = slugsFor({ parcoursEtudes: "secondaire-belge" });
    expect(sec).toContain("c109-36-diplome");
    expect(sec).not.toContain("c109-36-etranger");
    expect(sec).not.toContain("copie-diplome-superieur");

    // Supérieur belge → copie du diplôme (dispense), pas de formulaire école.
    const sup = slugsFor({ parcoursEtudes: "superieur-belge" });
    expect(sup).toContain("copie-diplome-superieur");
    expect(sup).not.toContain("c109-36-diplome");

    // Étranger → ÉTRANGER.
    expect(slugsFor({ parcoursEtudes: "etranger" })).toContain("c109-36-etranger");

    // Autre → ÉTRANGER aussi (il a remplacé l'ANNEXE).
    const autre = slugsFor({ parcoursEtudes: "autre" });
    expect(autre).toContain("c109-36-etranger");
    expect(autre).not.toContain("c109-36-diplome");
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

  it("les formulaires remplissables = DEMANDE, C1, DIPLÔME, ÉTRANGER (PDF officiels)", () => {
    const fillable = allocationsInsertion.documents.filter(
      (d) => (!d.responsibility || d.responsibility === "user") && d.fields.length > 0,
    );
    expect(fillable.map((d) => d.slug).sort()).toEqual(
      ["c1-insertion", "c109-36-demande", "c109-36-diplome", "c109-36-etranger"].sort(),
    );
    // Chaque remplissable pointe vers un PDF officiel committé.
    for (const d of fillable) {
      expect(d.sourcePdfPath).toMatch(/^private\/pdfs\/.+\.pdf$/);
    }
  });

  it("les formulaires d'études restent conditionnels (branche parcoursEtudes)", () => {
    // DIPLÔME + ÉTRANGER sont remplissables MAIS gardent leur includeWhen :
    // ils n'apparaissent que pour la bonne branche.
    expect(slugsFor({})).not.toContain("c109-36-diplome");
    expect(slugsFor({})).not.toContain("c109-36-etranger");
    expect(slugsFor({ parcoursEtudes: "secondaire-belge" })).toContain("c109-36-diplome");
    expect(slugsFor({ parcoursEtudes: "etranger" })).toContain("c109-36-etranger");
  });

  it("la DEMANDE mappe l'identité canonique (NISS, nom, date, signature)", () => {
    const demande = allocationsInsertion.documents.find(
      (d) => d.slug === "c109-36-demande",
    );
    const mapped = demande?.fields.flatMap((f) =>
      "field" in f ? [f.field] : [],
    );
    expect(mapped).toEqual(["niss", "fullName", "creationDate", "signature"]);
  });
});
