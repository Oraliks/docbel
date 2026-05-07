import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { DocumentField, GenerationPayload } from "./types";

export async function overlayPdfFlat(
  buffer: Buffer,
  fields: DocumentField[],
  payload: GenerationPayload
): Promise<Buffer> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();

  for (const field of fields) {
    if (!field.position) continue;
    const v = payload[field.id];
    if (v === null || v === undefined || v === "") continue;

    const page = pages[field.position.page];
    if (!page) continue;

    const fontSize = field.position.fontSize || 11;

    if (field.type === "checkbox") {
      if (v && v !== "false" && v !== "0") {
        page.drawText("X", {
          x: field.position.x,
          y: field.position.y,
          size: fontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
      continue;
    }

    const text = String(v);
    page.drawText(text, {
      x: field.position.x,
      y: field.position.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
      maxWidth: field.position.w > 0 ? field.position.w : undefined,
    });
  }

  const out = await doc.save();
  return Buffer.from(out);
}
