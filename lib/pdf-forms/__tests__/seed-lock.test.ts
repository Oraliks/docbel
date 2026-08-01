import { describe, it, expect } from "vitest";
import { isSeedManagedEditAttempt, SEED_MANAGED_LOCK_ERROR } from "../seed-lock";
import type { PdfFormField, PdfFormTrigger } from "../types";

function field(id: string): PdfFormField {
  return { id, pdfFieldName: id, type: "text", required: false, label: { fr: id } } as PdfFormField;
}

const existingFields: PdfFormField[] = [field("nom"), field("prenom")];
const existingTriggers: PdfFormTrigger[] = [
  { whenFieldId: "motif", whenValue: "demenagement", requiresFormSlug: "c1a" },
];

describe("isSeedManagedEditAttempt", () => {
  it("un formulaire NON semé n'est jamais bloqué, même avec des fields différents", () => {
    expect(
      isSeedManagedEditAttempt({
        seedManaged: false,
        existingFields,
        existingTriggers,
        bodyFields: [field("autre")],
        bodyTriggers: undefined,
      })
    ).toBe(false);
  });

  it("un save qui renvoie fields/triggers INCHANGÉS n'est PAS bloqué (cas normal du bouton Enregistrer)", () => {
    expect(
      isSeedManagedEditAttempt({
        seedManaged: true,
        existingFields,
        existingTriggers,
        bodyFields: existingFields.map((f) => ({ ...f })),
        bodyTriggers: existingTriggers.map((t) => ({ ...t })),
      })
    ).toBe(false);
  });

  it("fields et triggers absents du body (settings-only) n'est PAS bloqué", () => {
    expect(
      isSeedManagedEditAttempt({
        seedManaged: true,
        existingFields,
        existingTriggers,
        bodyFields: undefined,
        bodyTriggers: undefined,
      })
    ).toBe(false);
  });

  it("une VRAIE tentative de modification des fields est bloquée", () => {
    expect(
      isSeedManagedEditAttempt({
        seedManaged: true,
        existingFields,
        existingTriggers,
        bodyFields: [field("nom"), field("prenom"), field("champ_ajoute")],
        bodyTriggers: undefined,
      })
    ).toBe(true);
  });

  it("une VRAIE tentative de modification des triggers est bloquée", () => {
    expect(
      isSeedManagedEditAttempt({
        seedManaged: true,
        existingFields,
        existingTriggers,
        bodyFields: undefined,
        bodyTriggers: [{ whenFieldId: "motif", whenValue: "autre_chose", requiresFormSlug: "c1a" }],
      })
    ).toBe(true);
  });
});

describe("SEED_MANAGED_LOCK_ERROR", () => {
  it("porte le code seed_managed", () => {
    expect(SEED_MANAGED_LOCK_ERROR.code).toBe("seed_managed");
  });
});
