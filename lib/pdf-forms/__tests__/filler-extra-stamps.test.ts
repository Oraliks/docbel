import { describe, it, expect } from "vitest";
import { PDFDocument, PDFCheckBox, PDFTextField } from "pdf-lib";
import { fillForm } from "../filler";
import type { PdfFormField } from "../types";

/// PDF minimal avec 1 checkbox + 2 text fields dont un plafonné à maxLength=2
/// (simule le widget « B E » du C1 et son piège classique).
async function makeMixedPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();

  const cb = form.createCheckBox("modif");
  cb.addToPage(page, { x: 20, y: 300, width: 14, height: 14 });

  const t1 = form.createTextField("nom_titulaire");
  t1.addToPage(page, { x: 20, y: 250, width: 200, height: 20 });

  const t2 = form.createTextField("check_2");
  t2.setMaxLength(2);
  t2.addToPage(page, { x: 20, y: 200, width: 40, height: 20 });

  return Buffer.from(await doc.save());
}

describe("fillForm — extraStamps", () => {
  it("stampe checkbox true/false et text field via la Map", async () => {
    const pdf = await makeMixedPdf();
    const stamps = new Map<string, string | boolean>([
      ["modif", true],
      ["nom_titulaire", "Fatou N'Diaye"],
    ]);
    const { bytes } = await fillForm(pdf, [], {}, { flatten: false, extraStamps: stamps });
    const doc = await PDFDocument.load(bytes);
    const form = doc.getForm();
    expect((form.getField("modif") as PDFCheckBox).isChecked()).toBe(true);
    expect((form.getField("nom_titulaire") as PDFTextField).getText()).toBe("Fatou N'Diaye");
  });

  it("stampe par-dessus les valeurs schéma (dernier gagnant)", async () => {
    const pdf = await makeMixedPdf();
    const fields: PdfFormField[] = [
      {
        id: "modif",
        pdfFieldName: "modif",
        type: "checkbox",
        required: false,
        label: { fr: "Modif" },
      },
    ];
    // Champ schéma coche → puis extraStamps décoche → résultat attendu = false.
    const stamps = new Map<string, string | boolean>([["modif", false]]);
    const { bytes } = await fillForm(
      pdf,
      fields,
      { modif: true },
      { flatten: false, extraStamps: stamps }
    );
    const doc = await PDFDocument.load(bytes);
    expect((doc.getForm().getField("modif") as PDFCheckBox).isChecked()).toBe(false);
  });

  it("dépassement du maxLength : la génération finit, warning log, autres widgets ok", async () => {
    const pdf = await makeMixedPdf();
    // "12345" dépasse maxLength=2 → setText throw pdf-lib, mais le try/catch
    // du filler continue avec le widget suivant.
    const stamps = new Map<string, string | boolean>([
      ["check_2", "12345"],
      ["nom_titulaire", "OK"],
    ]);
    const warns: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...a: unknown[]) => {
      warns.push(a.map(String).join(" "));
    };
    try {
      const { bytes } = await fillForm(pdf, [], {}, { flatten: false, extraStamps: stamps });
      const doc = await PDFDocument.load(bytes);
      // L'autre widget a bien été rempli malgré l'échec sur check_2.
      expect((doc.getForm().getField("nom_titulaire") as PDFTextField).getText()).toBe("OK");
    } finally {
      console.warn = originalWarn;
    }
    // Au moins un warn concernant check_2.
    expect(warns.some((w) => w.includes("check_2"))).toBe(true);
  });

  it("widget inexistant → warn + skip, pas d'exception", async () => {
    const pdf = await makeMixedPdf();
    const stamps = new Map<string, string | boolean>([["widget_fantome", true]]);
    const warns: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...a: unknown[]) => {
      warns.push(a.map(String).join(" "));
    };
    try {
      await expect(
        fillForm(pdf, [], {}, { flatten: false, extraStamps: stamps })
      ).resolves.toBeDefined();
    } finally {
      console.warn = originalWarn;
    }
    expect(warns.some((w) => w.includes("widget_fantome"))).toBe(true);
  });

  it("Map vide → aucun effet, pas de warn", async () => {
    const pdf = await makeMixedPdf();
    const warns: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...a: unknown[]) => {
      warns.push(a.map(String).join(" "));
    };
    try {
      await fillForm(pdf, [], {}, { flatten: false, extraStamps: new Map() });
    } finally {
      console.warn = originalWarn;
    }
    expect(warns).toEqual([]);
  });
});
