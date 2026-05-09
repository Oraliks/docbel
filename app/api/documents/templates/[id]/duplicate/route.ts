import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { requireAdminAuth } from "@/lib/auth-check";

/// Duplique un template (avec son outil parent) sous un nouveau slug.
/// Utile pour créer un variant d'un document existant sans repartir de zéro.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  const original = await prisma.documentTemplate.findUnique({
    where: { id },
    include: { tool: true },
  });
  if (!original) {
    return NextResponse.json({ error: "Template introuvable" }, { status: 404 });
  }

  let body: { newName?: string; newSlug?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body optionnel
  }

  const newName = body.newName?.trim() || `${original.tool.name} (copie)`;
  const baseSlug = body.newSlug?.trim() || `${original.tool.slug}-copie`;
  const cleanBaseSlug = baseSlug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  // Trouver un slug unique en ajoutant -2, -3 si déjà pris
  let newSlug = cleanBaseSlug;
  let suffix = 2;
  while (await prisma.tool.findUnique({ where: { slug: newSlug } })) {
    newSlug = `${cleanBaseSlug}-${suffix++}`;
    if (suffix > 50) {
      return NextResponse.json({ error: "Trop de doublons, change le slug" }, { status: 409 });
    }
  }

  // Créer le nouveau Tool puis le DocumentTemplate
  const newTool = await prisma.tool.create({
    data: {
      sectionId: original.tool.sectionId,
      name: newName,
      slug: newSlug,
      description: original.tool.description,
      type: original.tool.type,
      icon: original.tool.icon,
      timeMin: original.tool.timeMin,
    },
  });

  const newTemplate = await prisma.documentTemplate.create({
    data: {
      toolId: newTool.id,
      sourceFileId: original.sourceFileId,
      sourceType: original.sourceType,
      schema: original.schema as Prisma.InputJsonValue,
      outputFilenameTpl: original.outputFilenameTpl,
      rgpdNotice: original.rgpdNotice,
      retentionDays: original.retentionDays,
      organismeId: original.organismeId,
      effectiveDate: original.effectiveDate,
      expiresAt: original.expiresAt,
      officialRef: original.officialRef ? `${original.officialRef} (copie)` : null,
      requiresSignature: original.requiresSignature,
      signaturePosition: (original.signaturePosition ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
      status: "draft", // toujours brouillon
    },
  });

  return NextResponse.json(
    {
      id: newTemplate.id,
      toolId: newTool.id,
      slug: newTool.slug,
      name: newTool.name,
    },
    { status: 201 }
  );
}
