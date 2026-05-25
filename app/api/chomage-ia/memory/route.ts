/**
 * Routes API pour la mémoire long-terme transversale (Feature 4).
 *
 * GET  /api/chomage-ia/memory?domain=chomage&importance=high
 * POST /api/chomage-ia/memory
 *
 * Toutes les routes : auth admin obligatoire.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  ChatMemoryCreateSchema,
  DEFAULT_DOMAIN,
  MEMORY_IMPORTANCES,
  type ChatMemoryListItem,
} from "@/lib/chomage-ia/types";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;
  const importance = url.searchParams.get("importance");
  const enabledParam = url.searchParams.get("enabled");

  const where: Record<string, unknown> = { domain };
  if (importance && (MEMORY_IMPORTANCES as readonly string[]).includes(importance)) {
    where.importance = importance;
  }
  if (enabledParam === "true") where.enabled = true;
  if (enabledParam === "false") where.enabled = false;

  const rows = await prisma.chatMemory.findMany({
    where,
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 500,
  });

  const items: ChatMemoryListItem[] = rows.map((r) => ({
    id: r.id,
    content: r.content,
    importance: r.importance as ChatMemoryListItem["importance"],
    enabled: r.enabled,
    domain: r.domain,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
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
    parsed = ChatMemoryCreateSchema.parse(body);
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

  const created = await prisma.chatMemory.create({
    data: {
      content: parsed.content,
      importance: parsed.importance ?? "medium",
      enabled: parsed.enabled ?? true,
      domain: parsed.domain ?? DEFAULT_DOMAIN,
      createdById: auth.user.id,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      content: created.content,
      importance: created.importance,
      enabled: created.enabled,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
