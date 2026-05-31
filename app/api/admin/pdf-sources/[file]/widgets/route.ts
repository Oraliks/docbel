import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { PDFDocument } from "pdf-lib";
import { requireAdminAuth } from "@/lib/auth-check";
import { parsePdf } from "@/lib/pdf-forms/acroform-parser";
import { getPageGeometry, type PageGeometry } from "@/lib/pdf-canvas/coords";

const json = { "Content-Type": "application/json; charset=utf-8" };

/// Dump des widgets AcroForm d'un PDF source + géométrie des pages.
/// La géométrie est calculée côté serveur (CropBox via pdf-lib) pour que le
/// front puisse projeter les rects au bon endroit même sans avoir attendu
/// que pdfjs ait rendu la page.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { file } = await params;
  const safe = basename(file);
  if (safe !== file || !safe.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400, headers: json });
  }
  const fullPath = join(process.cwd(), "private", "pdfs", safe);
  let buf: Buffer;
  try {
    buf = await readFile(fullPath);
  } catch {
    return NextResponse.json({ error: "PDF introuvable" }, { status: 404, headers: json });
  }

  const parsed = await parsePdf(buf);
  // Géométrie page par page (CropBox + rotation).
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const pages: Array<{ index: number; geometry: PageGeometry; rotation: number }> = doc
    .getPages()
    .map((p, i) => ({ index: i, geometry: getPageGeometry(p), rotation: p.getRotation().angle }));

  return NextResponse.json(
    {
      file: safe,
      pageCount: parsed.pageCount,
      hasAcroForm: parsed.hasAcroForm,
      pages,
      widgets: parsed.fields,
    },
    { headers: json }
  );
}
