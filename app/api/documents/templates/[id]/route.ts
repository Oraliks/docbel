import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { DocumentField } from "@/lib/documents/types";
import { computeSchemaDiff } from "@/lib/documents/diff";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: {
      tool: { select: { id: true, name: true, slug: true, description: true, icon: true } },
      sourceFile: { select: { id: true, name: true, fileType: true } },
      organisme: { select: { id: true, code: true, name: true, shortName: true, color: true } },
    },
  });
  if (!template) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  // Public uniquement si publié, sinon admin requis
  if (template.status !== "published") {
    const auth = await requireAdminAuth();
    if (!auth.isAuthorized) return auth.error;
  }

  return NextResponse.json(template);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await prisma.documentTemplate.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  let createRevision = false;
  let diffSummary: ReturnType<typeof computeSchemaDiff> | null = null;

  if (Array.isArray(body.schema)) {
    const cleanSchema = (body.schema as DocumentField[]).filter((f) => f && f.id && f.label && f.type);
    const oldSchema = (existing.schema as unknown as DocumentField[]) || [];
    const schemaChanged = JSON.stringify(oldSchema) !== JSON.stringify(cleanSchema);
    data.schema = cleanSchema as object;
    if (schemaChanged) {
      data.version = existing.version + 1;
      createRevision = true;
      diffSummary = computeSchemaDiff(oldSchema, cleanSchema);
    }
  }
  if (typeof body.rgpdNotice === "string" || body.rgpdNotice === null) {
    data.rgpdNotice = body.rgpdNotice;
  }
  if (typeof body.retentionDays === "number") {
    data.retentionDays = body.retentionDays;
  }
  if (typeof body.outputFilenameTpl === "string") {
    data.outputFilenameTpl = body.outputFilenameTpl;
  }
  if (body.status === "draft" || body.status === "published" || body.status === "archived") {
    data.status = body.status;
  }
  if (body.sourceType === "pdf_acroform" || body.sourceType === "pdf_flat" || body.sourceType === "docx") {
    data.sourceType = body.sourceType;
  }

  // Nouveaux champs (Phase 1+)
  if (body.organismeId !== undefined) {
    data.organismeId = body.organismeId || null;
  }
  if (body.effectiveDate !== undefined) {
    data.effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : null;
  }
  if (body.expiresAt !== undefined) {
    data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  }
  if (body.officialRef !== undefined) {
    data.officialRef = body.officialRef || null;
  }
  if (body.requiresSignature !== undefined) {
    data.requiresSignature = !!body.requiresSignature;
  }
  if (body.signaturePosition !== undefined) {
    data.signaturePosition = body.signaturePosition || null;
  }

  // Si le schema change, on archive l'ancien dans une révision avant l'update
  if (createRevision) {
    const changeNotes = typeof body.changeNotes === "string" ? body.changeNotes : null;
    const changeType =
      body.changeType === "major" || body.changeType === "hotfix" || body.changeType === "source_update"
        ? body.changeType
        : "minor";

    await prisma.documentTemplateRevision.create({
      data: {
        templateId: existing.id,
        version: existing.version,
        schema: existing.schema as object,
        sourceType: existing.sourceType,
        rgpdNotice: existing.rgpdNotice,
        retentionDays: existing.retentionDays,
        outputFilenameTpl: existing.outputFilenameTpl,
        changeNotes,
        changeType,
        diffSummary: diffSummary as object,
        createdBy: auth.user?.id || null,
      },
    });
  }

  const updated = await prisma.documentTemplate.update({
    where: { id },
    data,
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  await prisma.documentTemplate.update({
    where: { id },
    data: { status: "archived" },
  });
  return NextResponse.json({ ok: true });
}
