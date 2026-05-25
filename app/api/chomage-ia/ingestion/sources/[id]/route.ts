/**
 * GET    /api/chomage-ia/ingestion/sources/[id]
 * PATCH  /api/chomage-ia/ingestion/sources/[id]
 * DELETE /api/chomage-ia/ingestion/sources/[id]
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { IngestionSourceUpdateSchema } from "@/lib/chomage-ia/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;
  const row = await prisma.ingestionSource.findUnique({ where: { id } });
  if (!row) {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }
  return NextResponse.json({
    id: row.id,
    name: row.name,
    kind: row.kind,
    url: row.url,
    schedule: row.schedule,
    enabled: row.enabled,
    domain: row.domain,
    lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;
  const { id } = await params;
  const exists = await prisma.ingestionSource.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = IngestionSourceUpdateSchema.parse(body);
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
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.kind !== undefined) data.kind = parsed.kind;
  if (parsed.url !== undefined) data.url = parsed.url;
  if (parsed.schedule !== undefined) data.schedule = parsed.schedule;
  if (parsed.enabled !== undefined) data.enabled = parsed.enabled;
  if (parsed.domain !== undefined) data.domain = parsed.domain;

  const updated = await prisma.ingestionSource.update({ where: { id }, data });
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
    await prisma.ingestionSource.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
