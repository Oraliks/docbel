/**
 * PATCH  /api/chomage-ia/gaps/[id]   (resolve / ignore / reopen + notes)
 * DELETE /api/chomage-ia/gaps/[id]
 *
 * Pas de GET — la page admin charge tout via la route racine.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { KnowledgeGapUpdateSchema } from "@/lib/chomage-ia/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;
  const exists = await prisma.knowledgeGap.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Gap introuvable" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = KnowledgeGapUpdateSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Validation error"
            : "Validation error",
      },
      { status: 400 },
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.status !== undefined) {
    data.status = parsed.status;
    data.resolvedBy = parsed.status === "resolved" ? auth.user.id : null;
  }
  if (parsed.notes !== undefined) data.notes = parsed.notes;
  if (parsed.knowledgeSourceId !== undefined) {
    data.knowledgeSourceId = parsed.knowledgeSourceId;
  }

  const updated = await prisma.knowledgeGap.update({ where: { id }, data });
  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;
  try {
    await prisma.knowledgeGap.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Gap introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
