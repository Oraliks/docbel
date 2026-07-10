import { describe, it, expect } from "vitest";
import { PDFDocument, PDFCheckBox } from "pdf-lib";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

async function makeCheckboxPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 300]);
  const cb = doc.getForm().createCheckBox("alloc");
  cb.addToPage(page, { x: 20, y: 250, width: 9, height: 8 });
  return Buffer.from(await doc.save());
}

async function isChecked(bytes: Buffer): Promise<boolean> {
  const doc = await PDFDocument.load(bytes);
  const f = doc.getForm().getField("alloc");
  return f instanceof PDFCheckBox && f.isChecked();
}

const field: PdfFormField = {
  id: "allocationsFamiliales",
  pdfFieldName: "alloc",
  type: "radio",
  required: false,
  label: { fr: "Allocations" },
  options: [
    { value: "oui", label: { fr: "Oui" } },
    { value: "non", label: { fr: "Non" } },
  ],
};

describe("fillForm — case à cocher oui/non", () => {
  it("« oui » coche la case", async () => {
    const src = await makeCheckboxPdf();
    const { bytes } = await fillForm(src, [field], { allocationsFamiliales: "oui" }, { flatten: false });
    expect(await isChecked(bytes)).toBe(true);
  });

  it("« non » NE coche PAS la case", async () => {
    const src = await makeCheckboxPdf();
    const { bytes } = await fillForm(src, [field], { allocationsFamiliales: "non" }, { flatten: false });
    expect(await isChecked(bytes)).toBe(false);
  });

  it("un booléen true coche toujours (compat)", async () => {
    const src = await makeCheckboxPdf();
    const { bytes } = await fillForm(
      src,
      [{ ...field, type: "checkbox", options: undefined }],
      { allocationsFamiliales: true },
      { flatten: false }
    );
    expect(await isChecked(bytes)).toBe(true);
  });
});
