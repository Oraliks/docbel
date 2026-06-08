import { describe, it, expect } from "vitest";
import { PDFDocument, PDFCheckBox } from "pdf-lib";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

/// PDF minimal : 2 checkboxes nommées oui_2 et non_2 (simulation paire ONEM).
async function makePairPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  const yes = form.createCheckBox("oui_2");
  yes.addToPage(page, { x: 20, y: 200, width: 14, height: 14 });
  const no = form.createCheckBox("non_2");
  no.addToPage(page, { x: 60, y: 200, width: 14, height: 14 });
  return Buffer.from(await doc.save());
}

function checkboxPairField(): PdfFormField {
  return {
    id: "q",
    pdfFieldName: "oui_2|non_2",
    type: "radio",
    required: true,
    label: { fr: "Question" },
    options: [
      { value: "oui", label: { fr: "Oui" } },
      { value: "non", label: { fr: "Non" } },
    ],
  };
}

async function readChecks(pdf: Uint8Array): Promise<{ yes: boolean; no: boolean }> {
  const doc = await PDFDocument.load(pdf);
  const form = doc.getForm();
  const yes = form.getField("oui_2") as PDFCheckBox;
  const no = form.getField("non_2") as PDFCheckBox;
  return { yes: yes.isChecked(), no: no.isChecked() };
}

describe("fillForm — paire de checkboxes oui_N|non_N", () => {
  it("coche la case 'oui' et décoche 'non' quand value=oui", async () => {
    const pdf = await makePairPdf();
    const res = await fillForm(pdf, [checkboxPairField()], { q: "oui" }, { flatten: false });
    const state = await readChecks(res.bytes);
    expect(state.yes).toBe(true);
    expect(state.no).toBe(false);
  });

  it("coche la case 'non' et décoche 'oui' quand value=non", async () => {
    const pdf = await makePairPdf();
    const res = await fillForm(pdf, [checkboxPairField()], { q: "non" }, { flatten: false });
    const state = await readChecks(res.bytes);
    expect(state.yes).toBe(false);
    expect(state.no).toBe(true);
  });

  it("laisse les deux cases intactes (non cochées) si la value est vide", async () => {
    const pdf = await makePairPdf();
    // null / undefined → skip (cf. early continue dans fillForm)
    const res = await fillForm(pdf, [checkboxPairField()], { q: null }, { flatten: false });
    const state = await readChecks(res.bytes);
    expect(state.yes).toBe(false);
    expect(state.no).toBe(false);
  });

  it("ignore silencieusement si une des deux cases est introuvable", async () => {
    const pdf = await makePairPdf();
    const field: PdfFormField = {
      ...checkboxPairField(),
      pdfFieldName: "oui_2|non_inconnu", // 2e case n'existe pas dans le PDF
    };
    // Pas d'exception : juste pas de check de l'orpheline.
    await expect(fillForm(pdf, [field], { q: "oui" }, { flatten: false })).resolves.toBeDefined();
  });
});
