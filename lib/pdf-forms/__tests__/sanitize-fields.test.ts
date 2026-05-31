import { describe, it, expect } from "vitest";
import { sanitizeFields } from "../sanitize-fields";
import type { PdfFormField } from "../types";

function field(partial: Partial<PdfFormField>): PdfFormField {
  return {
    id: "f1",
    pdfFieldName: "Text1",
    type: "text",
    required: false,
    label: { fr: "Champ" },
    ...partial,
  } as PdfFormField;
}

describe("sanitizeFields", () => {
  it("garde un champ valide", () => {
    const out = sanitizeFields([field({})]);
    expect(out).toHaveLength(1);
  });

  it("garde un champ logique sans pdfFieldName (régression : ne PAS supprimer)", () => {
    // Un champ « purement logique » (ex. signature) a un pdfFieldName vide.
    // L'ancien filtre `f.pdfFieldName` le supprimait silencieusement à chaque
    // enregistrement → la modif n'était jamais persistée et le front gardait
    // l'ancien schéma.
    const logical = field({ id: "sig", pdfFieldName: "", type: "signature", label: { fr: "Signature" } });
    const out = sanitizeFields([logical]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("sig");
    expect(out[0].pdfFieldName).toBe("");
  });

  it("supprime les champs sans id", () => {
    expect(sanitizeFields([field({ id: "" })])).toHaveLength(0);
    expect(sanitizeFields([{ pdfFieldName: "X", type: "text" }])).toHaveLength(0);
  });

  it("supprime les champs sans type", () => {
    expect(sanitizeFields([{ ...field({}), type: "" }])).toHaveLength(0);
  });

  it("supprime les entrées nulles / non-objets", () => {
    expect(sanitizeFields([null, undefined, 42, "x", field({})])).toHaveLength(1);
  });

  it("renvoie [] pour une entrée non tableau", () => {
    expect(sanitizeFields(null)).toEqual([]);
    expect(sanitizeFields(undefined)).toEqual([]);
    expect(sanitizeFields({})).toEqual([]);
  });

  it("préserve l'ordre et toutes les propriétés métier", () => {
    const a = field({ id: "a", section: "identite", required: true });
    const b = field({ id: "b", pdfFieldName: "Text2", label: { fr: "B", nl: "B-nl" } });
    const out = sanitizeFields([a, b]);
    expect(out.map((f) => f.id)).toEqual(["a", "b"]);
    expect(out[0].section).toBe("identite");
    expect(out[1].label).toEqual({ fr: "B", nl: "B-nl" });
  });
});
