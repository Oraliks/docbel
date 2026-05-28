import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  StandardFonts,
} from "pdf-lib";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { PdfFormField, FormPayload } from "./types";

/// Chemin d'une police TTF Unicode optionnelle. Si présente, elle est
/// embarquée et utilisée pour réécrire les apparences des champs → support
/// complet des caractères hors Latin-1 (ł, ğ, ž, ș…) dans les noms étrangers.
/// Déposer p.ex. public/fonts/NotoSans-Regular.ttf.
const UNICODE_FONT_PATH = join(process.cwd(), "public", "fonts", "NotoSans-Regular.ttf");

async function loadUnicodeFont(): Promise<Buffer | null> {
  try {
    if (existsSync(UNICODE_FONT_PATH)) return await readFile(UNICODE_FONT_PATH);
  } catch {
    /* ignore */
  }
  return null;
}

function isTruthy(v: unknown): boolean {
  return !!v && v !== "false" && v !== "0" && v !== 0;
}

export interface FillResult {
  bytes: Buffer;
  /// true si la police Unicode a été embarquée.
  unicodeFont: boolean;
}

/// Remplit un PDF AcroForm à partir du schéma enrichi et d'un payload validé.
/// - Mappe chaque champ via `pdfFieldName` (ancre).
/// - Embarque une police Unicode si disponible (fontkit requis).
/// - Aplatit le formulaire par défaut (PDF non ré-éditable).
export async function fillForm(
  source: Buffer,
  fields: PdfFormField[],
  payload: FormPayload,
  opts: { flatten?: boolean } = {}
): Promise<FillResult> {
  const flatten = opts.flatten !== false;
  const doc = await PDFDocument.load(source, { ignoreEncryption: true });
  const form = doc.getForm();

  // Police : Unicode embarquée si dispo, sinon Helvetica standard.
  let unicodeFont = false;
  let font;
  const ttf = await loadUnicodeFont();
  if (ttf) {
    try {
      const fontkit = (await import("@pdf-lib/fontkit")).default;
      doc.registerFontkit(fontkit);
      font = await doc.embedFont(ttf, { subset: true });
      unicodeFont = true;
    } catch {
      font = await doc.embedFont(StandardFonts.Helvetica);
    }
  } else {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  for (const field of fields) {
    if (!field.pdfFieldName) continue;
    const value = payload[field.id];
    if (value === null || value === undefined) continue;

    let pdfField;
    try {
      pdfField = form.getField(field.pdfFieldName);
    } catch {
      continue;
    }

    try {
      if (pdfField instanceof PDFTextField) {
        pdfField.setText(value === false ? "" : String(value));
        if (unicodeFont) pdfField.updateAppearances(font);
      } else if (pdfField instanceof PDFCheckBox) {
        if (isTruthy(value)) pdfField.check();
        else pdfField.uncheck();
      } else if (pdfField instanceof PDFDropdown) {
        const s = String(value);
        if (pdfField.getOptions().includes(s)) {
          pdfField.select(s);
          if (unicodeFont) pdfField.updateAppearances(font);
        }
      } else if (pdfField instanceof PDFRadioGroup) {
        const s = String(value);
        if (pdfField.getOptions().includes(s)) pdfField.select(s);
      }
    } catch {
      // champ readonly / incompatible — on ignore sans casser la génération
    }
  }

  // Réécrit les apparences globales avec la police Unicode avant flatten.
  if (unicodeFont) {
    try {
      form.updateFieldAppearances(font);
    } catch {
      /* best-effort */
    }
  }

  if (flatten) {
    try {
      form.flatten();
    } catch {
      /* certains PDF refusent le flatten */
    }
  }

  const out = await doc.save();
  return { bytes: Buffer.from(out), unicodeFont };
}
