import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getFileBuffer, saveGeneratedDocument } from "@/lib/documents/storage";
import { fillAcroForm } from "@/lib/documents/pdf-acroform-filler";
import { overlayPdfFlat } from "@/lib/documents/pdf-flat-overlay";
import { fillDocxTemplate } from "@/lib/documents/docx-filler";
import { buildPayloadValidator } from "@/lib/documents/schema-zod";
import { sanitizeFieldValue } from "@/lib/documents/sanitize";
import { renderFilename } from "@/lib/documents/filename";
import { sha256Hex, signDownloadToken } from "@/lib/documents/token";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";
import { notifyAdminOfGeneration } from "@/lib/documents/email";
import { DocumentField, GenerationPayload, Lang } from "@/lib/documents/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`generate:${ip}:${templateId}`, {
    windowMs: 60_000,
    max: 5,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes, réessayez plus tard" },
      { status: 429 }
    );
  }

  const template = await prisma.documentTemplate.findUnique({
    where: { id: templateId },
    include: { sourceFile: true },
  });
  if (!template || template.status !== "published") {
    return NextResponse.json({ error: "Template indisponible" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawPayload = (body?.payload || {}) as Record<string, unknown>;
  const consent = body?.consent === true;
  const lang: Lang = body?.lang === "nl" ? "nl" : "fr";
  if (!consent) {
    return NextResponse.json(
      { error: "Consentement RGPD requis" },
      { status: 400 }
    );
  }

  const fields = (template.schema as unknown as DocumentField[]) || [];

  const sanitized: GenerationPayload = {};
  for (const f of fields) {
    sanitized[f.id] = sanitizeFieldValue(rawPayload[f.id], f.type, f.maxLength);
  }

  const validator = buildPayloadValidator(fields, lang);
  const result = validator.safeParse(sanitized);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Validation échouée",
        issues: result.error.issues.map((i) => ({
          field: i.path[0],
          message: i.message,
        })),
      },
      { status: 422 }
    );
  }

  const validated = result.data as GenerationPayload;

  const sourceBuffer = await getFileBuffer(template.sourceFileId);
  if (!sourceBuffer) {
    return NextResponse.json(
      { error: "Fichier source introuvable" },
      { status: 500 }
    );
  }

  let outputBuffer: Buffer;
  let outFileType: string;
  let extension: string;

  try {
    if (template.sourceType === "pdf_acroform") {
      outputBuffer = await fillAcroForm(sourceBuffer, fields, validated);
      outFileType = "pdf";
      extension = ".pdf";
    } else if (template.sourceType === "pdf_flat") {
      outputBuffer = await overlayPdfFlat(sourceBuffer, fields, validated);
      outFileType = "pdf";
      extension = ".pdf";
    } else if (template.sourceType === "docx") {
      outputBuffer = fillDocxTemplate(sourceBuffer, fields, validated);
      outFileType = "docx";
      extension = ".docx";
    } else {
      return NextResponse.json(
        { error: `sourceType inconnu: ${template.sourceType}` },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("Document generation error:", err);
    return NextResponse.json(
      { error: "Échec de génération du document" },
      { status: 500 }
    );
  }

  let filename = renderFilename(template.outputFilenameTpl, validated);
  if (!filename || filename === "document-{{date}}.pdf".replace("{{date}}", "")) {
    filename = `document-${Date.now()}${extension}`;
  }
  if (!filename.toLowerCase().endsWith(extension)) {
    filename += extension;
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id || null;

  const saved = await saveGeneratedDocument(
    outputBuffer,
    filename,
    outFileType,
    userId
  );

  const payloadHash = sha256Hex(JSON.stringify(validated));
  const ipHash = sha256Hex(ip);
  const expiresAt = new Date(Date.now() + template.retentionDays * 24 * 60 * 60 * 1000);

  const generated = await prisma.generatedDocument.create({
    data: {
      templateId: template.id,
      userId,
      outputFileId: saved.id,
      payloadHash,
      ipHash,
      expiresAt,
    },
    include: { template: { include: { tool: { select: { name: true, slug: true } } } } },
  });

  // Notification admin (silencieuse si non configurée)
  notifyAdminOfGeneration({
    templateName: generated.template.tool.name,
    toolSlug: generated.template.tool.slug,
    generatedId: generated.id,
    isAnonymous: !userId,
    userEmail: session?.user?.email || null,
    expiresAt,
  }).catch(() => {});

  const token = signDownloadToken(generated.id);
  return NextResponse.json({
    id: generated.id,
    filename,
    downloadUrl: `/api/documents/generated/${generated.id}/download?token=${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString(),
  });
}
