/**
 * Routes API d'une ChatMemory individuelle.
 *
 * GET    /api/chomage-ia/memory/[id]
 * PATCH  /api/chomage-ia/memory/[id]   (toggle enabled, edit content, importance)
 * DELETE /api/chomage-ia/memory/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { ChatMemoryUpdateSchema } from "@/lib/chomage-ia/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;
  const row = await prisma.chatMemory.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Memory introuvable" }, { status: 404 });
  }
  return NextResponse.json({
    id: row.id,
    content: row.content,
    importance: row.importance,
    enabled: row.enabled,
    domain: row.domain,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;
  const exists = await prisma.chatMemory.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Memory introuvable" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = ChatMemoryUpdateSchema.parse(body);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? err.issues[0]?.message || "Validation error"
            : "Validation error",
      },
      { status: 400 }
    );
  }

  const data: Record<string, unknown> = {};
  if (parsed.content !== undefined) data.content = parsed.content;
  if (parsed.importance !== undefined) data.importance = parsed.importance;
  if (parsed.enabled !== undefined) data.enabled = parsed.enabled;
  if (parsed.domain !== undefined) data.domain = parsed.domain;

  const updated = await prisma.chatMemory.update({ where: { id }, data });
  return NextResponse.json({
    id: updated.id,
    enabled: updated.enabled,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;
  try {
    await prisma.chatMemory.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Memory introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
