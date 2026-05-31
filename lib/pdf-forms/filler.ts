import {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFDropdown,
  PDFRadioGroup,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { PdfFormField, FormPayload, AcroFieldRaw } from "./types";
import { assembleFullName } from "./system-values";
import { resolveSignerName, buildSignatureBlock } from "./signature";
import { isSignatureField } from "./auto-fields";

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
/// - Pour les champs `signature` : embarque l'image PNG (data URL) à l'endroit
///   du widget AcroForm correspondant. Nécessite `technicalSchema` pour
///   retrouver le rectangle + la page du widget.
export async function fillForm(
  source: Buffer,
  fields: PdfFormField[],
  payload: FormPayload,
  opts: { flatten?: boolean; technicalSchema?: AcroFieldRaw[] } = {}
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

  // Police oblique pour la ligne "nom" du bloc de signature (effet manuscrit).
  const obliqueFont = await doc.embedFont(StandardFonts.HelveticaOblique);

  for (const field of fields) {
    if (!field.pdfFieldName) continue;
    const raw = payload[field.id];
    if (raw === null || raw === undefined) continue;
    // Champ composite : deux sous-champs front → une seule chaîne dans le PDF.
    const value = field.type === "fullname" ? assembleFullName(raw, field.nameOrder) : raw;

    let pdfField;
    try {
      pdfField = form.getField(field.pdfFieldName);
    } catch {
      continue;
    }

    try {
      // Signature numérique "façon Adobe" : si le champ est confirmé (valeur
      // non vide), on dessine un bloc texte (nom + mention + horodatage) à la
      // position du widget AcroForm. Le nom est résolu depuis le payload.
      if (isSignatureField(field)) {
        const confirmed = typeof value === "string" && value.trim() !== "";
        if (!confirmed) continue;
        const tech = (opts.technicalSchema ?? []).find((t) => t.pdfFieldName === field.pdfFieldName);
        if (!tech?.rect) continue;
        if (pdfField instanceof PDFTextField) pdfField.setText("");

        const signerName = resolveSignerName(fields, payload) || (typeof value === "string" ? value : "");
        if (!signerName) continue;
        const block = buildSignatureBlock(signerName);

        const pageIdx = Math.max(0, Math.min(doc.getPageCount() - 1, tech.page ?? 0));
        const page = doc.getPage(pageIdx);
        const [bx, by, bw, bh] = tech.rect;
        const pad = 4;

        // Cadre léger.
        page.drawRectangle({
          x: bx,
          y: by,
          width: bw,
          height: bh,
          color: rgb(0.96, 0.95, 1),
          opacity: 0.5,
          borderColor: rgb(0.42, 0.4, 0.62),
          borderWidth: 0.5,
        });

        const nameSize = Math.min(13, Math.max(8, bh / 3.2));
        const small = Math.max(5.5, Math.min(7.5, bh / 6));
        let cy = by + bh - pad - nameSize;
        page.drawText(block.name, { x: bx + pad, y: cy, size: nameSize, font: obliqueFont, color: rgb(0.1, 0.1, 0.3) });
        cy -= small + 4;
        page.drawText(block.by, { x: bx + pad, y: cy, size: small, font, color: rgb(0.32, 0.32, 0.42) });
        cy -= small + 2;
        page.drawText(block.date, { x: bx + pad, y: cy, size: small, font, color: rgb(0.32, 0.32, 0.42) });
        continue;
      }

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
