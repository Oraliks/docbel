import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { getFileBuffer } from "@/lib/documents/storage";
import { parseAcroForm } from "@/lib/documents/pdf-acroform-parser";
import { extractDocxPlaceholders } from "@/lib/documents/docx-filler";
import { DocumentField } from "@/lib/documents/types";

export async function POST(
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
    return NextResponse.json(
      { error: "Impossible de lire le fichier source" },
      { status: 500 }
    );
  }

  let detected: DocumentField[] = [];
  if (template.sourceFile.fileType === "pdf") {
    const parsed = await parseAcroForm(buffer);
    detected = parsed.fields;
  } else if (template.sourceFile.fileType === "docx") {
    const placeholders = extractDocxPlaceholders(buffer);
    detected = placeholders.map((p) => ({
      id: p,
      label: p,
      type: "text" as const,
      required: false,
    }));
  }

  // Fusion: on garde les champs existants (avec leurs configs), on ajoute les nouveaux détectés
  const existingSchema = (template.schema as unknown as DocumentField[]) || [];
  const existingByKey = new Map<string, DocumentField>();
  for (const f of existingSchema) {
    const key = f.pdfFieldName || f.id;
    existingByKey.set(key, f);
  }

  const merged: DocumentField[] = [];
  const seenKeys = new Set<string>();
  for (const d of detected) {
    const key = d.pdfFieldName || d.id;
    seenKeys.add(key);
    const existing = existingByKey.get(key);
    if (existing) {
      merged.push(existing);
    } else {
      merged.push(d);
    }
  }
  // Conserver les champs existants qui n'ont pas été redétectés (champs manuels)
  for (const f of existingSchema) {
    const key = f.pdfFieldName || f.id;
    if (!seenKeys.has(key)) merged.push(f);
  }

  return NextResponse.json({
    detected,
    merged,
    pageCount: template.sourceFile.fileType === "pdf" ? undefined : null,
  });
}
