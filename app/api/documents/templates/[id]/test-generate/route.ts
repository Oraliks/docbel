import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { getFileBuffer } from "@/lib/documents/storage";
import { fillAcroForm } from "@/lib/documents/pdf-acroform-filler";
import { overlayPdfFlat } from "@/lib/documents/pdf-flat-overlay";
import { fillDocxTemplate } from "@/lib/documents/docx-filler";
import { generateSeedPayload } from "@/lib/documents/seed-data";
import { sanitizeFieldValue } from "@/lib/documents/sanitize";
import { DocumentField, GenerationPayload } from "@/lib/documents/types";

/// Endpoint admin pour générer un PDF de test avec données fictives.
/// Bypasse la vérification status=published (utile pour tester un brouillon).
/// La sortie n'est PAS sauvegardée en BDD — juste streamée pour téléchargement.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: { sourceFile: true, tool: { select: { slug: true } } },
  });
  if (!template) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  // Optionnel : payload fourni par l'admin, sinon génération automatique
  let body: { payload?: Record<string, unknown> } = {};
  try {
    body = await req.json();
  } catch {
    // Pas de body : on génère
  }

  const fields = (template.schema as unknown as DocumentField[]) || [];
  const rawPayload = body.payload || generateSeedPayload(fields);

  const sanitized: GenerationPayload = {};
  for (const f of fields) {
    sanitized[f.id] = sanitizeFieldValue(rawPayload[f.id], f.type, f.maxLength);
  }

  const sourceBuffer = await getFileBuffer(template.sourceFileId);
  if (!sourceBuffer) {
    return NextResponse.json({ error: "Source introuvable" }, { status: 500 });
  }

  let outputBuffer: Buffer;
  let mimeType: string;
  let extension: string;

  try {
    if (template.sourceType === "pdf_acroform") {
      outputBuffer = await fillAcroForm(sourceBuffer, fields, sanitized);
      mimeType = "application/pdf";
      extension = "pdf";
    } else if (template.sourceType === "pdf_flat") {
      outputBuffer = await overlayPdfFlat(sourceBuffer, fields, sanitized);
      mimeType = "application/pdf";
      extension = "pdf";
    } else if (template.sourceType === "docx") {
      outputBuffer = fillDocxTemplate(sourceBuffer, fields, sanitized);
      mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      extension = "docx";
    } else {
      return NextResponse.json({ error: "sourceType inconnu" }, { status: 400 });
    }
  } catch (err) {
    console.error("Test generation error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur" },
      { status: 500 }
    );
  }

  return new NextResponse(new Uint8Array(outputBuffer), {
    headers: {
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="test-${template.tool.slug}-${Date.now()}.${extension}"`,
      "X-Test-Generated": "true",
      "Cache-Control": "no-store",
    },
  });
}
