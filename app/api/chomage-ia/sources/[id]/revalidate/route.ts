/**
 * POST /api/chomage-ia/sources/[id]/revalidate
 *
 * Marque une KnowledgeSource comme "fresh" + set `lastValidatedAt = now`.
 * Utilisé par le bouton "Toujours en vigueur" dans le drawer de détail.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;

  const existing = await prisma.knowledgeSource.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }

  const updated = await prisma.knowledgeSource.update({
    where: { id },
    data: {
      lastValidatedAt: new Date(),
      validityStatus: "fresh",
    },
    select: {
      id: true,
      lastValidatedAt: true,
      validityStatus: true,
    },
  });

  return NextResponse.json({
    id: updated.id,
    lastValidatedAt: updated.lastValidatedAt?.toISOString() ?? null,
    validityStatus: updated.validityStatus,
  });
}
