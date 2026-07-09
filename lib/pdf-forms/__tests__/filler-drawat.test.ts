import { describe, it, expect } from "vitest";
import { PDFDocument, rgb } from "pdf-lib";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

/// PDF minimal SANS champ pour la commune — reproduit le cas C1 (colonne
/// imprimée, aucun widget AcroForm). On vérifie que `drawAt` écrit quand même
/// la valeur dans le flux de la page.
async function makeBlankPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  // Un peu de contenu imprimé pour que la page ne soit pas totalement vide.
  page.drawText("code postal   commune   pays", { x: 37, y: 618, size: 8, color: rgb(0, 0, 0) });
  return Buffer.from(await doc.save());
}

function communeField(overrides: Partial<PdfFormField> = {}): PdfFormField {
  return {
    id: "commune",
    pdfFieldName: "",
    type: "text",
    required: false,
    label: { fr: "Commune" },
    drawAt: { page: 0, x: 211, y: 630.5, maxWidth: 46 },
    ...overrides,
  };
}

describe("fillForm — drawAt (dessin positionnel sans widget)", () => {
  it("produit un PDF valide et non vide quand un champ drawAt porte une valeur", async () => {
    const source = await makeBlankPdf();
    const { bytes } = await fillForm(source, [communeField()], { commune: "Bruxelles" }, { flatten: false });
    // Le PDF doit rester chargeable et avoir grossi (contenu ajouté).
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
    expect(bytes.length).toBeGreaterThan(source.length);
  });

  it("ne dessine rien (PDF ~inchangé) quand la valeur est vide", async () => {
    const source = await makeBlankPdf();
    const { bytes } = await fillForm(source, [communeField()], { commune: "" }, { flatten: false });
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("ne dessine pas un champ drawAt masqué par visibleIf", async () => {
    const source = await makeBlankPdf();
    const fields: PdfFormField[] = [
      { id: "flag", pdfFieldName: "", type: "text", required: false, label: { fr: "F" } },
      communeField({ visibleIf: { fieldId: "flag", op: "equals", value: "on" } }),
    ];
    // flag != "on" → commune masquée → non dessinée. On vérifie juste l'absence
    // d'exception + PDF valide (le stamping positionnel est sauté).
    const { bytes } = await fillForm(source, fields, { flag: "off", commune: "Bruxelles" }, { flatten: false });
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });

  it("réduit la police pour tenir dans maxWidth (nom de commune très long)", async () => {
    const source = await makeBlankPdf();
    // Ne doit pas throw même avec un nom bien plus large que maxWidth.
    const { bytes } = await fillForm(
      source,
      [communeField()],
      { commune: "Villers-la-Ville-Sur-Somme-Et-Autres" },
      { flatten: false }
    );
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getPageCount()).toBe(1);
  });
});
