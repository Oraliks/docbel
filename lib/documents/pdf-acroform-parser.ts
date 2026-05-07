import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from "pdf-lib";
import { DocumentField, ParsedTemplate } from "./types";

function makeIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60) || `field_${Math.random().toString(36).slice(2, 8)}`;
}

function humanize(name: string): string {
  return name
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function parseAcroForm(buffer: Buffer): Promise<ParsedTemplate> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  let form;
  try {
    form = doc.getForm();
  } catch {
    return { fields: [], pageCount: doc.getPageCount() };
  }
  const fields = form.getFields();
  const out: DocumentField[] = [];
  const usedIds = new Set<string>();

  for (const f of fields) {
    const name = f.getName();
    let type: DocumentField["type"] = "text";
    let options: DocumentField["options"];

    if (f instanceof PDFTextField) {
      type = "text";
    } else if (f instanceof PDFCheckBox) {
      type = "checkbox";
    } else if (f instanceof PDFDropdown) {
      type = "select";
      options = f.getOptions().map((o) => ({ value: o, label: o }));
    } else if (f instanceof PDFRadioGroup) {
      type = "select";
      options = f.getOptions().map((o) => ({ value: o, label: o }));
    }

    let id = makeIdFromName(name);
    let suffix = 1;
    while (usedIds.has(id)) {
      id = `${makeIdFromName(name)}_${suffix++}`;
    }
    usedIds.add(id);

    out.push({
      id,
      pdfFieldName: name,
      label: humanize(name),
      type,
      required: false,
      options,
    });
  }

  return { fields: out, pageCount: doc.getPageCount() };
}
