import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

/// Reproduit le bug NISS/Date de naissance du C1 : le widget source impose
/// une taille de police FIXE (12pt) trop grande pour son rectangle — cf.
/// commentaire `autoSizeFont` dans types.ts (session 2026-07-08).
async function makeFixedFontPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const form = doc.getForm();
  const field = form.createTextField("niss-like");
  field.addToPage(page, { x: 20, y: 250, width: 100, height: 11 });
  field.setFontSize(12);
  return Buffer.from(await doc.save());
}

async function fontSizeOf(pdfBytes: Buffer, fieldName: string): Promise<number> {
  const doc = await PDFDocument.load(pdfBytes);
  const field = doc.getForm().getField(fieldName);
  const da = field.acroField.getDefaultAppearance() ?? "";
  const match = da.match(/\/\S+\s+([\d.]+)\s+Tf/);
  if (!match) throw new Error(`No Tf operator in DA: ${da}`);
  return Number(match[1]);
}

describe("fillForm — autoSizeFont", () => {
  it("recalcule une taille ajustée à la case (pdf-lib auto-fit) sur un widget marqué autoSizeFont, au lieu de garder la taille fixe du template", async () => {
    const source = await makeFixedFontPdf();
    const fields: PdfFormField[] = [
      {
        id: "niss",
        pdfFieldName: "niss-like",
        type: "text",
        required: true,
        label: { fr: "NISS" },
        autoSizeFont: true,
      },
    ];
    const { bytes } = await fillForm(source, fields, { niss: "94080549329" }, { flatten: false });
    const size = await fontSizeOf(bytes, "niss-like");
    // Case de 11pt de haut : ni la taille fixe du template (12, déborde déjà
    // seule), ni la taille uniforme du filler (10, toujours trop juste) —
    // pdf-lib doit avoir calculé un ajustement réellement plus petit.
    expect(size).toBeLessThan(9);
    expect(size).toBeGreaterThan(0);
  });

  it("garde la taille uniforme du filler quand autoSizeFont est absent", async () => {
    const source = await makeFixedFontPdf();
    const fields: PdfFormField[] = [
      {
        id: "autre",
        pdfFieldName: "niss-like",
        type: "text",
        required: true,
        label: { fr: "Autre champ" },
      },
    ];
    const { bytes } = await fillForm(source, fields, { autre: "valeur" }, { flatten: false });
    const size = await fontSizeOf(bytes, "niss-like");
    expect(size).toBe(10);
  });
});
