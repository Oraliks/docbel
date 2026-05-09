import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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
import { dataUrlToBuffer, isValidSignatureDataUrl, sha256 } from "@/lib/documents/signature";
import { DocumentField, GenerationPayload, Lang } from "@/lib/documents/types";

interface SignaturePayload {
  dataUrl: string;
  method?: "drawn" | "typed" | "uploaded";
  signerName?: string;
  signerEmail?: string;
}

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
  const signatureInput: SignaturePayload | null = body?.signature || null;
  const bundleRunId: string | null = typeof body?.bundleRunId === "string" ? body.bundleRunId : null;

  if (!consent) {
    return NextResponse.json(
      { error: "Consentement RGPD requis" },
      { status: 400 }
    );
  }

  // Validation signature si requise
  if (template.requiresSignature) {
    if (!signatureInput || !signatureInput.dataUrl) {
      return NextResponse.json(
        { error: "Signature requise pour ce document" },
        { status: 422 }
      );
    }
    if (!isValidSignatureDataUrl(signatureInput.dataUrl)) {
      return NextResponse.json(
        { error: "Format de signature invalide ou trop volumineux" },
        { status: 422 }
      );
    }
    if (!signatureInput.signerName || signatureInput.signerName.trim().length < 2) {
      return NextResponse.json(
        { error: "Nom du signataire requis" },
        { status: 422 }
      );
    }
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

  // Préparer signature (data URL → Buffer)
  const signatureBuffer = signatureInput?.dataUrl
    ? dataUrlToBuffer(signatureInput.dataUrl)
    : null;
  const signaturePosition = template.signaturePosition as
    | { page: number; x: number; y: number; w: number; h: number }
    | null;

  let outputBuffer: Buffer;
  let pdfHashBefore: string | null = null;
  let outFileType: string;
  let extension: string;

  try {
    if (template.sourceType === "pdf_acroform") {
      // AcroForm : on remplit puis si signature, on overlay
      const filled = await fillAcroForm(sourceBuffer, fields, validated);
      pdfHashBefore = sha256(filled);
      if (signatureBuffer && template.requiresSignature) {
        // Re-overlay la signature par-dessus le PDF AcroForm rempli
        outputBuffer = await overlayPdfFlat(filled, fields, validated, {
          signature: { buffer: signatureBuffer },
          signaturePosition,
        });
      } else {
        outputBuffer = filled;
      }
      outFileType = "pdf";
      extension = ".pdf";
    } else if (template.sourceType === "pdf_flat") {
      pdfHashBefore = sha256(sourceBuffer);
      outputBuffer = await overlayPdfFlat(sourceBuffer, fields, validated, {
        signature: signatureBuffer ? { buffer: signatureBuffer } : null,
        signaturePosition,
      });
      outFileType = "pdf";
      extension = ".pdf";
    } else if (template.sourceType === "docx") {
      // DOCX : pas de signature image (limitation actuelle, à faire en Phase 7+)
      if (template.requiresSignature) {
        return NextResponse.json(
          { error: "La signature n'est pas supportée pour les documents DOCX (uniquement PDF pour l'instant)" },
          { status: 415 }
        );
      }
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
      bundleRunId: bundleRunId || null,
      expiresAt,
    },
    include: { template: { include: { tool: { select: { name: true, slug: true } } } } },
  });

  // Si dans le cadre d'un bundle : persister le payload validé
  if (bundleRunId) {
    try {
      const run = await prisma.bundleRun.findUnique({ where: { id: bundleRunId } });
      if (run && run.status === "in_progress") {
        const currentPayloads = (run.payloads as Record<string, unknown>) || {};
        const currentCompleted = (run.completedTemplateIds as string[]) || [];
        const newPayloads = { ...currentPayloads, [template.id]: validated };
        const newCompleted = currentCompleted.includes(template.id)
          ? currentCompleted
          : [...currentCompleted, template.id];
        await prisma.bundleRun.update({
          where: { id: bundleRunId },
          data: {
            payloads: newPayloads as unknown as Prisma.InputJsonValue,
            completedTemplateIds: newCompleted as unknown as Prisma.InputJsonValue,
          },
        });
      }
    } catch (err) {
      console.error("BundleRun update failed:", err);
      // Ne fait pas échouer la génération
    }
  }

  // Si signé, créer le SignatureRecord
  if (signatureInput && signatureBuffer && template.requiresSignature) {
    try {
      await prisma.signatureRecord.create({
        data: {
          generatedDocumentId: generated.id,
          signerName: signatureInput.signerName!.trim(),
          signerEmail: signatureInput.signerEmail || session?.user?.email || null,
          signerUserId: userId,
          signatureImageData: signatureInput.dataUrl,
          signatureMethod: signatureInput.method || "drawn",
          ipAddress: ip,
          userAgent: req.headers.get("user-agent") || null,
          pdfHashBefore: pdfHashBefore || sha256(outputBuffer),
          pdfHashAfter: sha256(outputBuffer),
          payloadHash,
        },
      });
    } catch (err) {
      console.error("Échec création SignatureRecord:", err);
      // On ne fait pas échouer la génération pour autant
    }
  }

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
    signed: !!signatureInput && template.requiresSignature,
  });
}
