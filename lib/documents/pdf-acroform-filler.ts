import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";
import { DocumentField, GenerationPayload } from "./types";

export async function fillAcroForm(
  buffer: Buffer,
  fields: DocumentField[],
  payload: GenerationPayload,
  flatten = true
): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const form = doc.getForm();

  for (const field of fields) {
    if (!field.pdfFieldName) continue;
    const v = payload[field.id];
    if (v === null || v === undefined) continue;

    let pdfField;
    try {
      pdfField = form.getField(field.pdfFieldName);
    } catch {
      continue;
    }

    try {
      if (pdfField instanceof PDFTextField) {
        pdfField.setText(String(v));
      } else if (pdfField instanceof PDFCheckBox) {
        if (v && v !== "false" && v !== "0") {
          pdfField.check();
        } else {
          pdfField.uncheck();
        }
      } else if (pdfField instanceof PDFDropdown) {
        const stringValue = String(v);
        if (pdfField.getOptions().includes(stringValue)) {
          pdfField.select(stringValue);
        }
      } else if (pdfField instanceof PDFRadioGroup) {
        const stringValue = String(v);
        if (pdfField.getOptions().includes(stringValue)) {
          pdfField.select(stringValue);
        }
      }
    } catch {
      // ignore — champ peut-être readonly ou autre
    }
  }

  if (flatten) {
    try {
      form.flatten();
    } catch {
      // certains PDF refusent le flatten — on continue quand même
    }
  }

  const out = await doc.save();
  return Buffer.from(out);
}
