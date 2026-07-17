import { describe, expect, it } from "vitest";

import { allocationsInsertion } from "../allocations-insertion";
import { selectDocuments, type DossierAnswers } from "../types";

/** Slugs des documents applicables pour un jeu de réponses. */
function slugsFor(answers: DossierAnswers): string[] {
  return selectDocuments(allocationsInsertion, answers).map((d) => d.slug);
}

// Documents TOUJOURS présents (aucun `includeWhen` — cf. 2026-07 : plus de
// question d'aiguillage, tous les documents sont listés d'emblée, le citoyen
// choisit lui-même celui qui correspond à sa situation).
const BASELINE = [
  "c109-36-demande",
  "attestation-inscription-a15",
  "evaluations-positives-sip",
];

// Documents dont l'applicabilité dépend de la situation du citoyen, mais qui
// sont désormais TOUS listés sans filtrage (leur intitulé/note indique à qui
// ils s'adressent — ex. « si tu as moins de 21 ans »).
const SITUATIONAL = [
  "c109-36-diplome",
  "copie-diplome-superieur",
  "c109-36-etranger",
  "c109-36-condition21ans",
  "c4-reduction-sip",
];

describe("allocations-insertion — arbre de documents", () => {
  it("aucune question d'aiguillage : tous les documents sont toujours listés", () => {
    expect(slugsFor({}).sort()).toEqual([...BASELINE, ...SITUATIONAL].sort());
    // Les réponses éventuelles (compatibilité ascendante du type DossierAnswers)
    // n'ont plus aucun effet sur la liste — plus aucun document ne lit `a.*`.
    expect(
      slugsFor({ parcoursEtudes: "secondaire-belge", age: "moins-18", aTravaille: "true" }).sort(),
    ).toEqual([...BASELINE, ...SITUATIONAL].sort());
  });

  it("le CERTIFICAT et l'ANNEXE (abrogés au 01/03/2026) n'existent plus", () => {
    const slugs = allocationsInsertion.documents.map((d) => d.slug);
    expect(slugs).not.toContain("c109-36-certificat");
    expect(slugs).not.toContain("c109-36-annexe");
  });

  it("les pièces tierces ne sont pas remplissables (fields vides, responsibility ≠ user)", () => {
    for (const doc of allocationsInsertion.documents) {
      if (doc.responsibility && doc.responsibility !== "user") {
        expect(doc.fields).toHaveLength(0);
      }
    }
  });

  it("les formulaires remplissables = DEMANDE, DIPLÔME, ÉTRANGER (PDF officiels)", () => {
    const fillable = allocationsInsertion.documents.filter(
      (d) => (!d.responsibility || d.responsibility === "user") && d.fields.length > 0,
    );
    expect(fillable.map((d) => d.slug).sort()).toEqual(
      ["c109-36-demande", "c109-36-diplome", "c109-36-etranger"].sort(),
    );
    // Chaque remplissable pointe vers un PDF officiel committé.
    for (const d of fillable) {
      expect(d.sourcePdfPath).toMatch(/^private\/pdfs\/.+\.pdf$/);
    }
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

  it("aucune question d'aiguillage (le dossier n'en a plus besoin)", () => {
    expect(allocationsInsertion.questions).toEqual([]);
  });
});
