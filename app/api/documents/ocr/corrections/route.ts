import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

/// GET → liste des corrections OCR connues, filtrable par templateId.
/// Renvoie d'abord les corrections du template courant, puis les globales.
export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const templateId = url.searchParams.get("templateId");

  // Si un templateId est fourni : on prend ses corrections + les globales (templateId null)
  // Sinon : seulement les globales
  const where = templateId
    ? { OR: [{ templateId }, { templateId: null }] }
    : { templateId: null };

  const corrections = await prisma.ocrCorrectionMemory.findMany({
    where,
    orderBy: [{ occurrences: "desc" }, { updatedAt: "desc" }],
    take: 500,
  });

  return NextResponse.json(corrections);
}

/// POST → enregistre une nouvelle correction (ou incrémente occurrences si déjà connue).
/// Body: { rawLabel, cleanLabel, fieldType?, presetId?, templateId? }
export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { rawLabel, cleanLabel, fieldType, presetId, templateId } = body || {};
  if (!rawLabel || !cleanLabel) {
    return NextResponse.json({ error: "rawLabel et cleanLabel requis" }, { status: 400 });
  }
  if (rawLabel.length > 200 || cleanLabel.length > 200) {
    return NextResponse.json({ error: "Labels trop longs (200 max)" }, { status: 400 });
  }

  // Cherche une correction identique existante pour incrémenter au lieu de dupliquer
  const existing = await prisma.ocrCorrectionMemory.findFirst({
    where: {
      templateId: templateId || null,
      rawLabel,
      cleanLabel,
    },
  });

  let saved;
  if (existing) {
    saved = await prisma.ocrCorrectionMemory.update({
      where: { id: existing.id },
      data: {
        occurrences: { increment: 1 },
        fieldType: fieldType ?? existing.fieldType,
        presetId: presetId ?? existing.presetId,
      },
    });
  } else {
    saved = await prisma.ocrCorrectionMemory.create({
      data: {
        templateId: templateId || null,
        rawLabel,
        cleanLabel,
        fieldType: fieldType || null,
        presetId: presetId || null,
        createdBy: auth.user?.id || null,
      },
    });
  }
  return NextResponse.json({ ok: true, id: saved.id, occurrences: saved.occurrences });
}
