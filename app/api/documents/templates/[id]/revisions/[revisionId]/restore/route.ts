import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; revisionId: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id, revisionId } = await params;

  const [template, revision] = await Promise.all([
    prisma.documentTemplate.findUnique({ where: { id } }),
    prisma.documentTemplateRevision.findUnique({ where: { id: revisionId } }),
  ]);

  if (!template) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }
  if (!revision || revision.templateId !== id) {
    return NextResponse.json({ error: "Révision introuvable" }, { status: 404 });
  }

  // Archiver l'état actuel dans une nouvelle révision avant le rollback
  await prisma.documentTemplateRevision.create({
    data: {
      templateId: template.id,
      version: template.version,
      schema: template.schema as object,
      sourceType: template.sourceType,
      rgpdNotice: template.rgpdNotice,
      retentionDays: template.retentionDays,
      outputFilenameTpl: template.outputFilenameTpl,
      createdBy: auth.user?.id || null,
    },
  });

  const updated = await prisma.documentTemplate.update({
    where: { id },
    data: {
      schema: revision.schema as object,
      sourceType: revision.sourceType,
      rgpdNotice: revision.rgpdNotice,
      retentionDays: revision.retentionDays,
      outputFilenameTpl: revision.outputFilenameTpl,
      version: template.version + 1,
    },
  });

  return NextResponse.json({
    ok: true,
    restoredFromVersion: revision.version,
    newVersion: updated.version,
  });
}
