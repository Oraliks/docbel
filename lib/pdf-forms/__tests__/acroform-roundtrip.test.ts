import { describe, it, expect } from "vitest";
import { PDFDocument, PDFName, PDFString, PDFTextField, PDFCheckBox } from "pdf-lib";
import { parsePdf } from "../acroform-parser";
import { buildEnrichedSchema } from "../field-inference";
import { fillForm } from "../filler";

/// Construit un PDF AcroForm de test (texte + tooltip + maxlen, checkbox, dropdown).
async function makeSamplePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();

  const niss = form.createTextField("niss_field");
  niss.setMaxLength(11);
  niss.addToPage(page, { x: 20, y: 320, width: 200, height: 20 });
  niss.acroField.dict.set(PDFName.of("TU"), PDFString.of("Numéro de registre national"));

  const agree = form.createCheckBox("accord");
  agree.addToPage(page, { x: 20, y: 280, width: 14, height: 14 });

  const choice = form.createDropdown("langue");
  choice.setOptions(["FR", "NL", "DE"]);
  choice.addToPage(page, { x: 20, y: 240, width: 120, height: 20 });

  return Buffer.from(await doc.save());
}

describe("AcroForm parse + fill round-trip", () => {
  it("extrait les champs avec type, tooltip et maxLen", async () => {
    const pdf = await makeSamplePdf();
    const parsed = await parsePdf(pdf);
    expect(parsed.hasAcroForm).toBe(true);

    const byName = Object.fromEntries(parsed.fields.map((f) => [f.pdfFieldName, f]));
    expect(byName["niss_field"].acroType).toBe("text");
    expect(byName["niss_field"].tooltip).toBe("Numéro de registre national");
    expect(byName["niss_field"].maxLen).toBe(11);
    expect(byName["accord"].acroType).toBe("checkbox");
    expect(byName["langue"].acroType).toBe("dropdown");
    expect(byName["langue"].options).toEqual(["FR", "NL", "DE"]);
  });

  it("infère le type sémantique NISS depuis le tooltip", async () => {
    const pdf = await makeSamplePdf();
    const parsed = await parsePdf(pdf);
    const enriched = buildEnrichedSchema(parsed.fields);
    const niss = enriched.find((f) => f.pdfFieldName === "niss_field");
    expect(niss?.type).toBe("niss");
    expect(niss?.label.fr).toBe("Numéro de registre national");
  });

  it("remplit les champs (round-trip non aplati)", async () => {
    const pdf = await makeSamplePdf();
    const parsed = await parsePdf(pdf);
    const enriched = buildEnrichedSchema(parsed.fields);

    const payload = {
      [enriched.find((f) => f.pdfFieldName === "niss_field")!.id]: "85073003328",
      [enriched.find((f) => f.pdfFieldName === "accord")!.id]: true,
      [enriched.find((f) => f.pdfFieldName === "langue")!.id]: "NL",
    };

    const { bytes } = await fillForm(pdf, enriched, payload, { flatten: false });

    const out = await PDFDocument.load(bytes);
    const outForm = out.getForm();
    const t = outForm.getField("niss_field");
    const c = outForm.getField("accord");
    expect(t instanceof PDFTextField && t.getText()).toBe("85073003328");
    expect(c instanceof PDFCheckBox && c.isChecked()).toBe(true);
  });
});
