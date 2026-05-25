/**
 * GET  /api/chomage-ia/ingestion/sources
 * POST /api/chomage-ia/ingestion/sources
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  IngestionSourceCreateSchema,
  DEFAULT_DOMAIN,
  type IngestionSourceListItem,
} from "@/lib/chomage-ia/types";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;

  const rows = await prisma.ingestionSource.findMany({
    where: { domain },
    orderBy: [{ enabled: "desc" }, { name: "asc" }],
  });

  // Pour chaque source, compte les docs pending pour le badge UI.
  const pendingCounts = await prisma.ingestedDocument.groupBy({
    by: ["ingestionSourceId"],
    where: { status: "pending" },
    _count: { _all: true },
  });
  const pendingMap = new Map(
    pendingCounts.map((c) => [c.ingestionSourceId, c._count._all]),
  );

  const items: IngestionSourceListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    kind: r.kind as IngestionSourceListItem["kind"],
    url: r.url,
    schedule: r.schedule as IngestionSourceListItem["schedule"],
    enabled: r.enabled,
    domain: r.domain,
    lastCheckedAt: r.lastCheckedAt ? r.lastCheckedAt.toISOString() : null,
    lastSuccessAt: r.lastSuccessAt ? r.lastSuccessAt.toISOString() : null,
    lastError: r.lastError,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    pendingCount: pendingMap.get(r.id) ?? 0,
  }));

  return NextResponse.json({ items, count: items.length });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = IngestionSourceCreateSchema.parse(body);
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

  const created = await prisma.ingestionSource.create({
    data: {
      name: parsed.name,
      kind: parsed.kind,
      url: parsed.url,
      schedule: parsed.schedule ?? "daily",
      enabled: parsed.enabled ?? true,
      domain: parsed.domain ?? DEFAULT_DOMAIN,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      name: created.name,
      url: created.url,
      kind: created.kind,
      enabled: created.enabled,
    },
    { status: 201 },
  );
}
