import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { DocumentField } from "@/lib/documents/types";

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
  if (Array.isArray(body.schema)) {
    const cleanSchema = (body.schema as DocumentField[]).filter((f) => f && f.id && f.label && f.type);
    const schemaChanged =
      JSON.stringify(existing.schema) !== JSON.stringify(cleanSchema);
    data.schema = cleanSchema as object;
    if (schemaChanged) {
      data.version = existing.version + 1;
      createRevision = true;
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

  // Si le schema change, on archive l'ancien dans une révision avant l'update
  if (createRevision) {
    await prisma.documentTemplateRevision.create({
      data: {
        templateId: existing.id,
        version: existing.version,
        schema: existing.schema as object,
        sourceType: existing.sourceType,
        rgpdNotice: existing.rgpdNotice,
        retentionDays: existing.retentionDays,
        outputFilenameTpl: existing.outputFilenameTpl,
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
