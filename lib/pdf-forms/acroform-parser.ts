import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  PDFName,
  PDFString,
  PDFHexString,
  PDFNumber,
  PDFDict,
} from "pdf-lib";
import { AcroFieldRaw, AcroFieldType, ParsedPdf } from "./types";

/// Flags AcroForm (/Ff). Bits 1-based dans la spec → masques.
const FLAG_READONLY = 1 << 0; // bit 1
const FLAG_REQUIRED = 1 << 1; // bit 2
const FLAG_MULTILINE = 1 << 12; // bit 13 (text fields)

/// Extraction d'un texte (/TU, /DV…) depuis le dict d'un champ, gérant les
/// deux encodages PDF (literal string et hex string). Best-effort.
function readText(acroDict: PDFDict, key: string): string | undefined {
  try {
    const v = acroDict.lookupMaybe(PDFName.of(key), PDFString, PDFHexString);
    const text = v?.decodeText().trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

function readNumber(acroDict: PDFDict, key: string): number | undefined {
  try {
    const v = acroDict.lookupMaybe(PDFName.of(key), PDFNumber);
    return v ? v.asNumber() : undefined;
  } catch {
    return undefined;
  }
}

function acroTypeOf(field: unknown): AcroFieldType {
  if (field instanceof PDFTextField) return "text";
  if (field instanceof PDFCheckBox) return "checkbox";
  if (field instanceof PDFDropdown) return "dropdown";
  if (field instanceof PDFRadioGroup) return "radio";
  return "unknown";
}

/// Parse un PDF et renvoie les champs AcroForm bruts + métadonnées.
/// Ne lève jamais : un PDF sans formulaire renvoie `hasAcroForm: false`.
export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pageCount = doc.getPageCount();
  const pageRefs = doc.getPages().map((p) => p.ref.toString());

  let form;
  try {
    form = doc.getForm();
  } catch {
    return { fields: [], pageCount, hasAcroForm: false };
  }

  const rawFields = form.getFields();
  const out: AcroFieldRaw[] = [];

  for (const field of rawFields) {
    let pdfFieldName: string;
    try {
      pdfFieldName = field.getName();
    } catch {
      continue;
    }
    if (!pdfFieldName) continue;

    const acroType = acroTypeOf(field);
    const acroDict = field.acroField.dict;

    const raw: AcroFieldRaw = {
      pdfFieldName,
      acroType,
      tooltip: readText(acroDict, "TU"),
    };

    // Flags (/Ff) — peut être hérité ; on lit aussi via les helpers typés.
    const ff = readNumber(acroDict, "Ff") ?? 0;
    raw.readOnly = (ff & FLAG_READONLY) !== 0;
    raw.required = (ff & FLAG_REQUIRED) !== 0;

    // Valeur par défaut (/DV) — best-effort en texte.
    const dv = readText(acroDict, "DV");
    if (dv) raw.defaultValue = dv;

    if (field instanceof PDFTextField) {
      raw.multiline = (ff & FLAG_MULTILINE) !== 0;
      const maxLen = (() => {
        try {
          return field.getMaxLength();
        } catch {
          return undefined;
        }
      })();
      if (typeof maxLen === "number" && maxLen > 0) raw.maxLen = maxLen;
    } else if (field instanceof PDFDropdown || field instanceof PDFRadioGroup) {
      try {
        const opts = field.getOptions();
        if (opts.length) raw.options = opts;
      } catch {
        // ignore
      }
    }

    // Position du premier widget (page + rectangle) — utile au regroupement.
    try {
      const widgets = field.acroField.getWidgets();
      if (widgets.length) {
        const w = widgets[0];
        const rect = w.getRectangle();
        raw.rect = [rect.x, rect.y, rect.width, rect.height];
        const pRef = w.dict.get(PDFName.of("P"));
        if (pRef) {
          const idx = pageRefs.indexOf(pRef.toString());
          if (idx >= 0) raw.page = idx;
        }
      }
    } catch {
      // pas de widget exploitable — non bloquant
    }

    out.push(raw);
  }

  return { fields: out, pageCount, hasAcroForm: out.length > 0 };
}
