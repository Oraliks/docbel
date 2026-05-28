import { parsePdf } from "./acroform-parser";
import { buildEnrichedSchema } from "./field-inference";
import { sha256Hex } from "./security";
import { AcroFieldRaw, PdfFormField } from "./types";

export const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 Mo

export interface IngestResult {
  technicalSchema: AcroFieldRaw[];
  fields: PdfFormField[];
  pageCount: number;
  sha256: string;
  byteSize: number;
  hasAcroForm: boolean;
}

/// Parse un PDF uploadé et produit les deux niveaux de schéma.
export async function ingestPdf(buffer: Buffer): Promise<IngestResult> {
  const parsed = await parsePdf(buffer);
  return {
    technicalSchema: parsed.fields,
    fields: buildEnrichedSchema(parsed.fields),
    pageCount: parsed.pageCount,
    sha256: sha256Hex(buffer),
    byteSize: buffer.byteLength,
    hasAcroForm: parsed.hasAcroForm,
  };
}

/// Transforme un titre en slug unique-friendly.
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "formulaire"
  );
}

/// Lit un File (FormData) en Buffer après validation type/taille.
export async function readPdfUpload(
  file: unknown
): Promise<{ buffer: Buffer; name: string } | { error: string }> {
  if (!(file instanceof File)) return { error: "Fichier PDF manquant" };
  if (file.type && file.type !== "application/pdf") return { error: "Le fichier doit être un PDF" };
  if (file.size > MAX_PDF_BYTES) return { error: "PDF trop volumineux (25 Mo max)" };
  const buffer = Buffer.from(await file.arrayBuffer());
  // Vérif signature PDF (%PDF-)
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return { error: "Fichier PDF invalide" };
  }
  return { buffer, name: file.name || "form.pdf" };
}
