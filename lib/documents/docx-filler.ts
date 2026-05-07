import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { DocumentField, GenerationPayload } from "./types";

export function fillDocxTemplate(
  buffer: Buffer,
  fields: DocumentField[],
  payload: GenerationPayload
): Buffer {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  const data: Record<string, unknown> = {};
  for (const field of fields) {
    const v = payload[field.id];
    if (field.type === "checkbox") {
      data[field.id] = v ? "X" : "";
    } else {
      data[field.id] = v ?? "";
    }
  }

  doc.render(data);
  return doc.getZip().generate({ type: "nodebuffer" });
}

export function extractDocxPlaceholders(buffer: Buffer): string[] {
  const zip = new PizZip(buffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });
  const text = doc.getFullText();
  const matches = text.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1, -1))));
}
