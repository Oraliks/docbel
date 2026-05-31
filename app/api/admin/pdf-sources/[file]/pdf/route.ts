import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { requireAdminAuth } from "@/lib/auth-check";

/// Sert le binaire d'un PDF source de private/pdfs/ pour qu'il soit rendu
/// dans le navigateur par react-pdf. Admin-only.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { file } = await params;
  // Guard path traversal : on n'autorise QUE des noms simples sous le dossier.
  const safe = basename(file);
  if (safe !== file || !safe.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Nom de fichier invalide" }, { status: 400 });
  }
  const fullPath = join(process.cwd(), "private", "pdfs", safe);
  let buf: Buffer;
  try {
    buf = await readFile(fullPath);
  } catch {
    return NextResponse.json({ error: "PDF introuvable" }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
