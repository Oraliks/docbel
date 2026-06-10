import {
  PDFDocument,
  PDFFont,
  PDFForm,
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
import {
  PdfFormField,
  FieldOption,
  FieldValue,
  FieldValueRecord,
  FormPayload,
  AcroFieldRaw,
  isFieldValueRecordArray,
} from "./types";
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

/// Récupère un widget checkbox par son nom. Renvoie null si introuvable ou
/// si le widget existe mais n'est pas une PDFCheckBox (le caller décide quoi
/// faire — souvent ignorer silencieusement).
function safeCheckbox(form: ReturnType<PDFDocument["getForm"]>, name: string): PDFCheckBox | null {
  try {
    const f = form.getField(name);
    return f instanceof PDFCheckBox ? f : null;
  } catch {
    return null;
  }
}

export interface FillResult {
  bytes: Buffer;
  /// true si la police Unicode a été embarquée.
  unicodeFont: boolean;
}

/// Convention pipe-séparée : `pdfFieldName` = "w1|w2|…|wN" pour un champ
/// `radio` à N options, où chaque widget est une checkbox indépendante. La
/// fonction coche le widget correspondant à la valeur sélectionnée et décoche
/// les autres. Renvoie `true` si la convention a été appliquée (handled),
/// `false` sinon (le caller doit retomber sur le stamping scalaire standard).
function stampPipeRadio(
  form: PDFForm,
  pdfFieldName: string,
  type: PdfFormField["type"],
  options: FieldOption[] | undefined,
  value: FieldValue
): boolean {
  if (!pdfFieldName.includes("|") || type !== "radio" || !options) return false;
  // Pas de `filter(Boolean)` : on garde les positions exactes. Une entrée
  // vide signifie « cette option n'a pas de case PDF dédiée ».
  const names = pdfFieldName.split("|").map((s) => s.trim());
  if (names.length !== options.length) return false;
  const strValue = String(value);
  for (let i = 0; i < names.length; i++) {
    if (!names[i]) continue; // option sans widget — rien à faire
    const box = safeCheckbox(form, names[i]);
    if (!box) continue;
    try {
      if (options[i].value === strValue) box.check();
      else box.uncheck();
    } catch {
      /* readonly / incompatible */
    }
  }
  return true;
}

/// Stampe une valeur scalaire sur un widget AcroForm résolu, en dispatchant
/// sur son type (texte / checkbox / dropdown / radio group). Centralise la
/// logique pour la réutiliser depuis le stamping de lignes d'`array`.
function stampScalarWidget(
  pdfField: unknown,
  value: FieldValue,
  font: PDFFont,
  unicodeFont: boolean
): void {
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
}

/// Stamping d'un champ `array` : deux mécanismes complémentaires.
///   1. PAR LIGNE : pour chaque sous-champ porteur de `pdfFieldNameTemplate`,
///      on substitue `{index}` (1-based) et on stampe la valeur du
///      sous-champ. Sub-fields sans template = ignorés silencieusement.
///   2. FIRST-MATCH : si `firstMatchMapping` est défini, on cherche la PREMIÈRE
///      ligne qui satisfait `where` et on déverse ses sous-champs sur les
///      widgets uniques listés dans `fields`. Convention :
///        - un nom de widget standard → stamping scalaire
///        - un nom pipe-séparé "w1|w2" sur un sous-champ `radio` → convention
///          ONEM (paire oui/non ou N options).
function stampArrayField(
  form: PDFForm,
  font: PDFFont,
  unicodeFont: boolean,
  field: PdfFormField,
  rows: FieldValueRecord[]
): void {
  const subFields = field.itemFields ?? [];
  if (subFields.length === 0) return;
  // Tronque silencieusement au maxRows annoncé pour ne jamais stamper hors grille.
  const cap = typeof field.maxRows === "number" ? Math.max(0, field.maxRows) : rows.length;
  const effectiveRows = rows.slice(0, cap);

  // (1) Stamping par ligne sur les widgets positionnels.
  for (let i = 0; i < effectiveRows.length; i++) {
    const row = effectiveRows[i];
    const oneBased = String(i + 1);
    for (const sub of subFields) {
      if (!sub.pdfFieldNameTemplate) continue;
      const subValue = row[sub.id];
      if (subValue === null || subValue === undefined) continue;
      const widgetName = sub.pdfFieldNameTemplate.replace(/\{index\}/g, oneBased);
      // Sous-champ radio + pipe → convention multi-options.
      if (
        stampPipeRadio(form, widgetName, sub.type, sub.options, subValue as FieldValue)
      ) {
        continue;
      }
      let pdfField;
      try {
        pdfField = form.getField(widgetName);
      } catch {
        continue;
      }
      try {
        stampScalarWidget(pdfField, subValue as FieldValue, font, unicodeFont);
      } catch {
        /* readonly / incompatible */
      }
    }
  }

  // (2) Stamping first-match sur les widgets uniques (ex. bloc « partenaire »).
  const fm = field.firstMatchMapping;
  if (!fm) return;
  const match = effectiveRows.find((row) => row[fm.where.fieldId] === fm.where.value);
  if (!match) return;
  for (const [subId, widgetName] of Object.entries(fm.fields)) {
    if (!widgetName) continue;
    const sub = subFields.find((s) => s.id === subId);
    if (!sub) continue;
    const subValue = match[subId];
    if (subValue === null || subValue === undefined) continue;
    if (
      stampPipeRadio(form, widgetName, sub.type, sub.options, subValue as FieldValue)
    ) {
      continue;
    }
    let pdfField;
    try {
      pdfField = form.getField(widgetName);
    } catch {
      continue;
    }
    try {
      stampScalarWidget(pdfField, subValue as FieldValue, font, unicodeFont);
    } catch {
      /* readonly / incompatible */
    }
  }
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
    // Branche dédiée aux champs `array` : stamping positionnel par ligne
    // (template `pdfFieldNameTemplate` sur chaque sous-champ) + stamping
    // « first-match » sur des widgets uniques (cf. firstMatchMapping). Ces
    // deux mécanismes sont indépendants — un schéma peut n'en utiliser qu'un.
    if (field.type === "array") {
      const rows = payload[field.id];
      if (!isFieldValueRecordArray(rows)) continue;
      stampArrayField(form, font, unicodeFont, field, rows);
      continue;
    }

    if (!field.pdfFieldName) continue;
    const raw = payload[field.id];
    if (raw === null || raw === undefined) continue;
    // Champ composite : deux sous-champs front → une seule chaîne dans le PDF.
    const value = field.type === "fullname" ? assembleFullName(raw, field.nameOrder) : raw;

    // Radio dont la valeur sélectionne UNE case parmi N : la convention
    // `pdfFieldName` est un pipe-séparateur listant les noms des widgets
    // dans le même ordre que `options`. Le widget correspondant à l'option
    // sélectionnée est coché, les autres décochés. Cas typique sur les
    // formulaires ONEM : chaque modalité a sa propre case (pas un
    // PDFRadioGroup). La paire oui/non est juste le sous-cas N=2.
    if (
      stampPipeRadio(form, field.pdfFieldName, field.type, field.options, value)
    ) {
      continue;
    }

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

      stampScalarWidget(pdfField, value, font, unicodeFont);
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
