import { describe, it, expect } from "vitest";
import { PDFDocument, PDFTextField, PDFCheckBox, degrees, PDFHexString, PDFName, PDFString } from "pdf-lib";
import { materializeVisualFields, MaterializeError } from "../materialize";
import { parsePdf } from "../../acroform-parser";
import type { VisualFieldsDoc } from "../types";

async function blankPdf(opts: { rotation?: number; pages?: number } = {}): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const n = opts.pages ?? 1;
  for (let i = 0; i < n; i += 1) {
    const page = doc.addPage([595, 842]);
    if (opts.rotation) page.setRotation(degrees(opts.rotation));
  }
  return Buffer.from(await doc.save());
}

async function pdfWithAcroForm(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const f = doc.getForm().createTextField("existing_field");
  f.addToPage(page, { x: 20, y: 100, width: 200, height: 20 });
  return Buffer.from(await doc.save());
}

const doc = (fields: VisualFieldsDoc["fields"], materializedNames?: string[]): VisualFieldsDoc => ({
  version: 1,
  fields,
  materializedNames,
});

describe("materializeVisualFields", () => {
  it("crée un text + une checkbox aux bonnes positions", async () => {
    const source = await blankPdf();
    const d = doc([
      {
        id: "f1",
        name: "nom_complet",
        type: "text",
        page: 0,
        rect: { x: 50, y: 700, w: 200, h: 24 },
        tooltip: "Nom complet (prénom + nom)",
        maxLen: 80,
      },
      {
        id: "f2",
        name: "accord",
        type: "checkbox",
        page: 0,
        rect: { x: 50, y: 660, w: 14, h: 14 },
        required: true,
      },
    ]);
    const res = await materializeVisualFields(source, d);
    expect(res.createdNames.sort()).toEqual(["accord", "nom_complet"]);

    // Re-parse pour vérifier
    const parsed = await parsePdf(res.bytes);
    expect(parsed.hasAcroForm).toBe(true);
    const byName = Object.fromEntries(parsed.fields.map((f) => [f.pdfFieldName, f]));

    expect(byName["nom_complet"].acroType).toBe("text");
    expect(byName["nom_complet"].tooltip).toBe("Nom complet (prénom + nom)");
    expect(byName["nom_complet"].maxLen).toBe(80);
    // pdf-lib ajoute une bordure de 0.5pt par côté lors de addToPage, donc
    // le rect lu peut différer de 1pt en largeur/hauteur et 0.5pt en x/y.
    const tol = 1.01;
    expect(Math.abs(byName["nom_complet"].rect![0] - 50)).toBeLessThan(tol);
    expect(Math.abs(byName["nom_complet"].rect![1] - 700)).toBeLessThan(tol);
    expect(Math.abs(byName["nom_complet"].rect![2] - 200)).toBeLessThan(tol);
    expect(Math.abs(byName["nom_complet"].rect![3] - 24)).toBeLessThan(tol);
    expect(byName["nom_complet"].page).toBe(0);

    expect(byName["accord"].acroType).toBe("checkbox");
    expect(byName["accord"].required).toBe(true);
    expect(Math.abs(byName["accord"].rect![0] - 50)).toBeLessThan(tol);
    expect(Math.abs(byName["accord"].rect![1] - 660)).toBeLessThan(tol);
  });

  it("refuse une page pivotée", async () => {
    const source = await blankPdf({ rotation: 90 });
    const d = doc([
      { id: "f1", name: "n", type: "text", page: 0, rect: { x: 0, y: 0, w: 50, h: 20 } },
    ]);
    await expect(materializeVisualFields(source, d)).rejects.toBeInstanceOf(MaterializeError);
  });

  it("refuse un PDF avec AcroForm existant", async () => {
    const source = await pdfWithAcroForm();
    const d = doc([
      { id: "f1", name: "n", type: "text", page: 0, rect: { x: 0, y: 0, w: 50, h: 20 } },
    ]);
    await expect(materializeVisualFields(source, d)).rejects.toBeInstanceOf(MaterializeError);
  });

  it("re-matérialise sans dupliquer (cleanup orphans)", async () => {
    const source = await blankPdf();
    const first = await materializeVisualFields(
      source,
      doc([{ id: "f1", name: "old_name", type: "text", page: 0, rect: { x: 10, y: 10, w: 100, h: 20 } }])
    );

    // Re-matérialise avec le même nom — il faut que l'unique champ s'appelle "new_name".
    // On simule en passant le nouveau doc qui « se souvient » d'avoir matérialisé "old_name".
    const second = await materializeVisualFields(
      first.bytes,
      doc(
        [{ id: "f2", name: "new_name", type: "text", page: 0, rect: { x: 10, y: 10, w: 100, h: 20 } }],
        ["old_name"]
      ),
      { rejectIfHasAcroForm: false }
    );

    const parsed = await parsePdf(second.bytes);
    const names = parsed.fields.map((f) => f.pdfFieldName).sort();
    expect(names).toEqual(["new_name"]);
  });

  it("écrit /TU en hex string Unicode (cyrillique)", async () => {
    const source = await blankPdf();
    const d = doc([
      {
        id: "f1",
        name: "n",
        type: "text",
        page: 0,
        rect: { x: 0, y: 0, w: 50, h: 20 },
        tooltip: "Привет — éàü",
      },
    ]);
    const res = await materializeVisualFields(source, d);
    const reloaded = await PDFDocument.load(res.bytes);
    const f = reloaded.getForm().getField("n") as PDFTextField;
    const tu = f.acroField.dict.lookup(PDFName.of("TU"));
    // Le tooltip doit avoir été préservé en Unicode
    if (tu instanceof PDFHexString || tu instanceof PDFString) {
      expect(tu.decodeText()).toBe("Привет — éàü");
    } else {
      throw new Error("TU manquant");
    }
  });

  it("PDFCheckBox.defaultChecked applique l'état coché", async () => {
    const source = await blankPdf();
    const res = await materializeVisualFields(
      source,
      doc([{ id: "c", name: "c", type: "checkbox", page: 0, rect: { x: 5, y: 5, w: 14, h: 14 }, defaultChecked: true }])
    );
    const loaded = await PDFDocument.load(res.bytes);
    const cb = loaded.getForm().getField("c") as PDFCheckBox;
    expect(cb.isChecked()).toBe(true);
  });
});
