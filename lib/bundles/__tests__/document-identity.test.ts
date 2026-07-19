import { describe, it, expect } from "vitest";
import { stableDocumentKey, documentPayloadsIdentical } from "../document-identity";

const fields = [
  { id: "niss", type: "niss" },
  { id: "nom", type: "text" },
  { id: "dateSignature", type: "date", label: { fr: "Date de signature" } },
  { id: "signature", type: "signature" },
  { id: "dateCreationDossier", type: "date", prefillFrom: "system.today" },
  { id: "motifIntroduction", type: "radio", autoAnswered: true },
];

describe("stableDocumentKey", () => {
  it("ignore les champs auto (signature, date création/signature, autoAnswered)", () => {
    const a = { niss: "123", nom: "Dupont", signature: "confirmed", dateSignature: "2026-07-18", dateCreationDossier: "2026-07-18", motifIntroduction: "modification" };
    const b = { niss: "123", nom: "Dupont", signature: "confirmed", dateSignature: "2026-07-19", dateCreationDossier: "2026-07-19", motifIntroduction: "modification" };
    // Seule la date auto diffère → clés identiques.
    expect(stableDocumentKey(a, fields)).toBe(stableDocumentKey(b, fields));
  });
  it("indépendant de l'ordre des clés + ignore les vides", () => {
    const a = { nom: "Dupont", niss: "123", extra: "" };
    const b = { niss: "123", nom: "Dupont" };
    expect(stableDocumentKey(a, fields)).toBe(stableDocumentKey(b, fields));
  });
  it("détecte une vraie différence de contenu", () => {
    const a = { niss: "123", nom: "Dupont" };
    const b = { niss: "123", nom: "Durand" };
    expect(documentPayloadsIdentical(a, b, fields)).toBe(false);
  });
  it("documentPayloadsIdentical = true sur un clone non modifié", () => {
    const a = { niss: "123", nom: "Dupont", signature: "confirmed", dateSignature: "2026-07-18" };
    const b = { ...a, dateSignature: "2026-07-20" };
    expect(documentPayloadsIdentical(a, b, fields)).toBe(true);
  });
});
