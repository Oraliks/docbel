/**
 * Routes API pour la knowledge base — GET (list) et POST (create).
 *
 * GET  /api/chomage-ia/sources?domain=chomage&enabled=true&kind=pdf&search=...
 * POST /api/chomage-ia/sources  (création d'une source texte/URL/tuto)
 *
 * Toutes les routes nécessitent l'auth admin.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import {
  KnowledgeSourceCreateSchema,
  DEFAULT_DOMAIN,
  type KnowledgeSourceListItem,
} from "@/lib/chomage-ia/types";
import { runAutoTagInBackground } from "@/lib/chomage-ia/auto-tag";
import { runIndexInBackground } from "@/lib/chomage-ia/indexer";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;
  const enabledParam = url.searchParams.get("enabled");
  const kind = url.searchParams.get("kind");
  const validity = url.searchParams.get("validity");
  const search = url.searchParams.get("search")?.trim();

  const where: Record<string, unknown> = { domain };
  if (enabledParam === "true") where.enabled = true;
  if (enabledParam === "false") where.enabled = false;
  if (kind) where.kind = kind;
  if (validity && ["fresh", "stale", "obsolete", "unknown"].includes(validity)) {
    where.validityStatus = validity;
  }
  if (search && search.length >= 2) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { content: { contains: search, mode: "insensitive" } },
      { summary: { contains: search, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.knowledgeSource.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  const items: KnowledgeSourceListItem[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    kind: r.kind,
    summary: r.summary,
    sourceUrl: r.sourceUrl,
    fileId: r.fileId,
    tags: r.tags,
    enabled: r.enabled,
    domain: r.domain,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    contentPreview: r.content.slice(0, 240),
    contentLength: r.content.length,
    indexedAt: r.indexedAt ? r.indexedAt.toISOString() : null,
    indexError: r.indexError,
    folderId: r.folderId,
    validityStatus: r.validityStatus as KnowledgeSourceListItem["validityStatus"],
    lastValidatedAt: r.lastValidatedAt ? r.lastValidatedAt.toISOString() : null,
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
    parsed = KnowledgeSourceCreateSchema.parse(body);
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

  // Validation folderId : si !== null, doit pointer sur un folder existant.
  if (parsed.folderId) {
    const folder = await prisma.knowledgeFolder.findUnique({
      where: { id: parsed.folderId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json(
        { error: "Dossier cible introuvable" },
        { status: 400 },
      );
    }
  }

  const created = await prisma.knowledgeSource.create({
    data: {
      title: parsed.title,
      kind: parsed.kind,
      content: parsed.content,
      summary: parsed.summary ?? null,
      sourceUrl: parsed.sourceUrl ?? null,
      fileId: parsed.fileId ?? null,
      tags: parsed.tags ?? [],
      enabled: parsed.enabled ?? true,
      domain: parsed.domain ?? DEFAULT_DOMAIN,
      folderId: parsed.folderId ?? null,
      createdById: auth.user.id,
    },
  });

  // Auto-tag fire-and-forget : ne bloque pas la réponse client.
  // Si Haiku échoue, les tags existants sont conservés tels quels.
  void runAutoTagInBackground(
    created.id,
    parsed.content,
    parsed.title,
    parsed.tags ?? []
  );

  // Indexing RAG fire-and-forget. Si Voyage/OpenAI sont indisponibles ou
  // si le content est trop court, `indexKnowledgeSource` marque indexError
  // et le chat retombe sur le fallback "toute la KB" (cf. context.ts).
  runIndexInBackground(created.id);

  return NextResponse.json(
    {
      id: created.id,
      title: created.title,
      kind: created.kind,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
