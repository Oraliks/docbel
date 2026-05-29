import {
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFNumber,
  StandardFonts,
} from "pdf-lib";
import type { VisualFieldsDoc, VisualField } from "./types";
import { cleanupOrphanWidgets } from "./cleanup-orphans";

/// Bit flags AcroForm (/Ff) — spec PDF 12.7.3.1.
const FLAG_READONLY = 1 << 0;
const FLAG_REQUIRED = 1 << 1;
const FLAG_MULTILINE = 1 << 12;

export interface MaterializeOptions {
  /// Si true, refuse les PDF qui contiennent déjà un AcroForm avec ≥1 champ.
  /// (Par défaut true en v1 — la fusion est out-of-scope.)
  rejectIfHasAcroForm?: boolean;
}

export interface MaterializeResult {
  bytes: Buffer;
  /// Noms des champs effectivement créés (à persister dans `materializedNames`).
  createdNames: string[];
}

export class MaterializeError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "MaterializeError";
  }
}

/// Matérialise un VisualFieldsDoc en AcroForms natifs dans le PDF source.
/// - Refuse si une page du doc cible a une rotation ≠ 0 (out-of-scope v1).
/// - Refuse si AcroForm existant (rejectIfHasAcroForm).
/// - Supprime d'abord les champs précédemment matérialisés (`materializedNames`)
///   ET nettoie leurs widgets orphelins, pour permettre la re-matérialisation
///   sans accumuler de fantômes.
export async function materializeVisualFields(
  source: Buffer,
  doc: VisualFieldsDoc,
  opts: MaterializeOptions = {}
): Promise<MaterializeResult> {
  const reject = opts.rejectIfHasAcroForm !== false;
  const pdf = await PDFDocument.load(source, { ignoreEncryption: true });

  // Refus si PDF déjà porteur d'un AcroForm avec champs.
  if (reject) {
    try {
      const existingForm = pdf.getForm();
      const existing = existingForm.getFields();
      if (existing.length > 0) {
        throw new MaterializeError(
          "ACROFORM_EXISTS",
          `Le PDF contient déjà un AcroForm (${existing.length} champ(s)). La fusion n'est pas supportée en v1.`
        );
      }
    } catch (e) {
      if (e instanceof MaterializeError) throw e;
      // getForm peut lever pour un PDF sans /AcroForm — c'est ce qu'on veut.
    }
  }

  const pages = pdf.getPages();

  // Refus si rotation ≠ 0 sur une page ciblée par un champ.
  for (const f of doc.fields) {
    const page = pages[f.page];
    if (!page) {
      throw new MaterializeError(
        "PAGE_OUT_OF_RANGE",
        `Champ « ${f.name} » : page ${f.page + 1} hors plage (PDF a ${pages.length} page(s)).`
      );
    }
    const rot = page.getRotation().angle;
    if (rot !== 0) {
      throw new MaterializeError(
        "ROTATED_PAGE",
        `La page ${f.page + 1} est pivotée (${rot}°) — non supportée en v1.`
      );
    }
  }

  // Cleanup des matérialisations précédentes.
  const previous = doc.materializedNames ?? [];
  if (previous.length) {
    try {
      const form = pdf.getForm();
      for (const name of previous) {
        try {
          form.removeField(form.getField(name));
        } catch {
          // ignore — peut-être déjà absent ou inexistant
        }
      }
    } catch {
      // pas d'AcroForm encore → rien à supprimer côté form
    }
    cleanupOrphanWidgets(pdf, previous);
  }

  const form = pdf.getForm();
  // Police par défaut pour les apparences (rendue uniquement à la demande
  // d'un viewer ; on n'aplatit pas ici).
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const created: string[] = [];

  for (const f of doc.fields) {
    const page = pages[f.page];
    createField(form, page, f, helv, created);
  }

  // Active /NeedAppearances pour que les viewers (re)génèrent les apparences
  // si jamais elles sont absentes. Sans ça, certains viewers (Chrome notamment)
  // n'affichent rien dans des Text fields vides.
  try {
    const acroForm = pdf.catalog.lookup(PDFName.of("AcroForm"));
    if (acroForm && "set" in acroForm) {
      (acroForm as { set: (k: PDFName, v: unknown) => void }).set(
        PDFName.of("NeedAppearances"),
        pdf.context.obj(true)
      );
    }
  } catch {
    /* best-effort */
  }

  const out = await pdf.save();
  return { bytes: Buffer.from(out), createdNames: created };
}

function createField(
  form: ReturnType<PDFDocument["getForm"]>,
  page: ReturnType<PDFDocument["getPages"]>[number],
  f: VisualField,
  font: Awaited<ReturnType<PDFDocument["embedFont"]>>,
  created: string[]
): void {
  const { x, y, w, h } = f.rect;
  if (f.type === "text") {
    const field = form.createTextField(f.name);
    field.addToPage(page, { x, y, width: w, height: h, font });
    let ff = 0;
    if (f.readOnly) ff |= FLAG_READONLY;
    if (f.required) ff |= FLAG_REQUIRED;
    if (f.multiline) {
      ff |= FLAG_MULTILINE;
      field.enableMultiline();
    }
    if (ff) field.acroField.dict.set(PDFName.of("Ff"), PDFNumber.of(ff));
    if (typeof f.maxLen === "number" && f.maxLen > 0) field.setMaxLength(f.maxLen);
    if (f.tooltip) {
      // /TU Unicode-safe (PDFHexString.fromText embarque le BOM UTF-16).
      field.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(f.tooltip));
    }
    if (f.defaultValue) field.setText(f.defaultValue);
    created.push(f.name);
    return;
  }
  if (f.type === "checkbox") {
    const field = form.createCheckBox(f.name);
    field.addToPage(page, { x, y, width: w, height: h });
    let ff = 0;
    if (f.readOnly) ff |= FLAG_READONLY;
    if (f.required) ff |= FLAG_REQUIRED;
    if (ff) field.acroField.dict.set(PDFName.of("Ff"), PDFNumber.of(ff));
    if (f.tooltip) {
      field.acroField.dict.set(PDFName.of("TU"), PDFHexString.fromText(f.tooltip));
    }
    if (f.defaultChecked) field.check();
    created.push(f.name);
    return;
  }
}
