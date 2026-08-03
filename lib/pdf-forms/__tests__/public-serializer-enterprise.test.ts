import { describe, expect, it } from "vitest";
import { toPublicField } from "../public-serializer";
import type { PdfFormField } from "../types";

describe("toPublicField — enterpriseAutocomplete", () => {
  it("copie le prop enterpriseAutocomplete vers la vue publique", () => {
    const field: PdfFormField = {
      id: "employeurNom",
      pdfFieldName: "14 Données concernant votre employeur",
      type: "text",
      required: true,
      label: { fr: "Nom de votre employeur" },
      section: "employeur",
      order: 63,
      enterpriseAutocomplete: { addressFieldId: "employeurAdresse" },
    };
    const pub = toPublicField(field);
    expect(pub.enterpriseAutocomplete).toEqual({ addressFieldId: "employeurAdresse" });
  });

  it("absent du schéma → absent de la vue publique", () => {
    const field: PdfFormField = {
      id: "autreChamp",
      pdfFieldName: "x",
      type: "text",
      required: false,
      label: { fr: "x" },
      section: "s",
      order: 1,
    };
    expect(toPublicField(field).enterpriseAutocomplete).toBeUndefined();
  });
});
