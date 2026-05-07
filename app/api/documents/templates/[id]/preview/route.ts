import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { getFileBuffer } from "@/lib/documents/storage";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: { sourceFile: true },
  });
  if (!template) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  const buffer = await getFileBuffer(template.sourceFileId);
  if (!buffer) {
    return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  }

  if (template.sourceFile.fileType === "docx") {
    try {
      const zip = new PizZip(buffer);
      const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
      const text = doc.getFullText();
      const placeholders = Array.from(
        new Set((text.match(/\{[a-zA-Z0-9_]+\}/g) || []).map((m) => m.slice(1, -1)))
      );
      return NextResponse.json({
        kind: "docx",
        text,
        placeholders,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Erreur" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ kind: template.sourceFile.fileType || "unknown" });
}
