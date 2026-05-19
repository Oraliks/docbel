import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";
import { DocumentField } from "@/lib/documents/types";
import { computeSchemaDiff } from "@/lib/documents/diff";
import { autoLearnFromSchema } from "@/lib/documents/auto-learn";

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
  let presetCountDeltas: Record<string, number> = {};

  if (Array.isArray(body.schema)) {
    const cleanSchema = (body.schema as DocumentField[]).filter((f) => f && f.id && f.label && f.type);
    const oldSchema = (existing.schema as unknown as DocumentField[]) || [];
    const schemaChanged = JSON.stringify(oldSchema) !== JSON.stringify(cleanSchema);
    data.schema = cleanSchema as unknown as Prisma.InputJsonValue;
    if (schemaChanged) {
      data.version = existing.version + 1;
      createRevision = true;
      diffSummary = computeSchemaDiff(oldSchema, cleanSchema);
      // Calculer les deltas d'usage de presets
      const oldCounts = countPresetUsage(oldSchema);
      const newCounts = countPresetUsage(cleanSchema);
      presetCountDeltas = computePresetDeltas(oldCounts, newCounts);
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
        schema: existing.schema as Prisma.InputJsonValue,
        sourceType: existing.sourceType,
        rgpdNotice: existing.rgpdNotice,
        retentionDays: existing.retentionDays,
        outputFilenameTpl: existing.outputFilenameTpl,
        changeNotes,
        changeType,
        diffSummary: (diffSummary ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        createdBy: auth.user?.id || null,
      },
    });
  }

  const updated = await prisma.documentTemplate.update({
    where: { id },
    data,
  });

  // Apprentissage automatique de la mémoire OCR (si le schema a changé).
  // Best-effort : ne bloque jamais la réponse en cas d'échec.
  if (createRevision && Array.isArray(body.schema)) {
    try {
      await autoLearnFromSchema(
        id,
        body.schema as DocumentField[],
        auth.user?.id ?? null
      );
    } catch (err) {
      console.warn("auto-learn failed (non-blocking):", err);
    }
  }

  // Mettre à jour usageCount des presets impactés (best-effort)
  for (const [presetId, delta] of Object.entries(presetCountDeltas)) {
    if (delta === 0) continue;
    try {
      await prisma.fieldValidationPreset.update({
        where: { id: presetId },
        data: { usageCount: { increment: delta } },
      });
    } catch {
      // Preset peut avoir été supprimé entre temps, on ignore
    }
  }

  return NextResponse.json(updated);
}

function countPresetUsage(schema: DocumentField[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of schema) {
    if (f.presetId) counts[f.presetId] = (counts[f.presetId] || 0) + 1;
  }
  return counts;
}

function computePresetDeltas(
  oldCounts: Record<string, number>,
  newCounts: Record<string, number>
): Record<string, number> {
  const deltas: Record<string, number> = {};
  const allIds = new Set([...Object.keys(oldCounts), ...Object.keys(newCounts)]);
  for (const id of allIds) {
    const delta = (newCounts[id] || 0) - (oldCounts[id] || 0);
    if (delta !== 0) deltas[id] = delta;
  }
  return deltas;
}

/// DELETE par défaut = archive (status="archived"), réversible.
/// DELETE avec ?hard=true&confirmSlug=<slug> = suppression DÉFINITIVE.
/// La suppression définitive cascade sur :
///   - DocumentTemplateRevision (historique des versions)
///   - GeneratedDocument (documents générés par les utilisateurs)
///   - DocumentDraft (brouillons en cours)
///   - DocumentBundleItem (présence dans des bundles)
///   - SignatureRecord (audit signature) via cascade GeneratedDocument
/// Le Tool parent et le File source ne sont PAS supprimés.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "true";
  const confirmSlug = url.searchParams.get("confirmSlug");

  if (!hard) {
    // Soft-delete : archive
    await prisma.documentTemplate.update({
      where: { id },
      data: { status: "archived" },
    });
    return NextResponse.json({ ok: true, archived: true });
  }

  // Hard delete : on exige le slug pour éviter les accidents
  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: {
      tool: { select: { id: true, slug: true, name: true } },
      _count: {
        select: {
          generated: true,
          revisions: true,
          drafts: true,
          bundleItems: true,
        },
      },
    },
  });

  if (!template) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  if (confirmSlug !== template.tool.slug) {
    return NextResponse.json(
      {
        error: "Confirmation invalide",
        expectedSlug: template.tool.slug,
        related: template._count,
      },
      { status: 422 }
    );
  }

  // Décrémenter les usageCount des presets utilisés avant suppression
  type FieldWithPreset = { presetId?: string };
  const fields = (template.schema as unknown as FieldWithPreset[]) || [];
  const presetCounts: Record<string, number> = {};
  for (const f of fields) {
    if (f.presetId) presetCounts[f.presetId] = (presetCounts[f.presetId] || 0) + 1;
  }
  for (const [presetId, count] of Object.entries(presetCounts)) {
    try {
      await prisma.fieldValidationPreset.update({
        where: { id: presetId },
        data: { usageCount: { decrement: count } },
      });
    } catch {
      // ignore
    }
  }

  // Suppression cascade (les FK ont onDelete: Cascade dans le schema)
  await prisma.documentTemplate.delete({ where: { id } });

  return NextResponse.json({
    ok: true,
    hardDeleted: true,
    affected: template._count,
  });
}
