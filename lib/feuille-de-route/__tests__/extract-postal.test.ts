import { describe, expect, it } from "vitest";
import { postalCodeFromPayloads } from "../extract-postal";
import type { PdfFormField } from "@/lib/pdf-forms/types";

// Champ minimal façon seed C1 : le CP porte la clé canonique
// adresse.codePostal (cf. lib/pdf-forms/seed/c1/identite.ts).
function champCp(id: string, canonicalKey?: string): PdfFormField {
  return { id, pdfFieldName: "", type: "text", label: { fr: "CP" }, section: "s", order: 1, canonicalKey } as PdfFormField;
}

describe("postalCodeFromPayloads", () => {
  it("extrait le CP via la clé canonique adresse.codePostal", () => {
    const cp = postalCodeFromPayloads([
      { fields: [champCp("cp", "adresse.codePostal")], payload: { cp: "1210" } },
    ]);
    expect(cp).toBe("1210");
  });

  it("repli sur l'id de champ code_postal du C1 quand aucune clé canonique", () => {
    const cp = postalCodeFromPayloads([
      { fields: [champCp("code_postal")], payload: { code_postal: " 4000 " } },
    ]);
    expect(cp).toBe("4000");
  });

  it("ignore les valeurs non belges (pas 4 chiffres) et continue sur le formulaire suivant", () => {
    const cp = postalCodeFromPayloads([
      { fields: [champCp("cp", "adresse.codePostal")], payload: { cp: "75011" } },
      { fields: [champCp("cp", "adresse.codePostal")], payload: { cp: "1000" } },
    ]);
    expect(cp).toBe("1000");
  });

  it("null quand rien n'est extractible", () => {
    expect(postalCodeFromPayloads([])).toBeNull();
    expect(
      postalCodeFromPayloads([{ fields: [champCp("autre")], payload: { autre: "abc" } }]),
    ).toBeNull();
  });
});
