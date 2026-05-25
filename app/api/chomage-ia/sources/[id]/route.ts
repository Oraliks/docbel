/**
 * Routes API d'une KnowledgeSource individuelle.
 *
 * GET    /api/chomage-ia/sources/[id]  → détail complet (content entier)
 * PATCH  /api/chomage-ia/sources/[id]  → édition partielle (toggle enabled, content, tags…)
 * DELETE /api/chomage-ia/sources/[id]  → suppression
 *
 * Auth admin obligatoire pour les 3.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { KnowledgeSourceUpdateSchema } from "@/lib/chomage-ia/types";
import { runIndexInBackground } from "@/lib/chomage-ia/indexer";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const source = await prisma.knowledgeSource.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }
  return NextResponse.json({
    id: source.id,
    title: source.title,
    kind: source.kind,
    content: source.content,
    summary: source.summary,
    sourceUrl: source.sourceUrl,
    fileId: source.fileId,
    tags: source.tags,
    enabled: source.enabled,
    domain: source.domain,
    folderId: source.folderId,
    validityStatus: source.validityStatus,
    lastValidatedAt: source.lastValidatedAt
      ? source.lastValidatedAt.toISOString()
      : null,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const exists = await prisma.knowledgeSource.findUnique({
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
    parsed = KnowledgeSourceUpdateSchema.parse(body);
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
  if (parsed.folderId !== undefined && parsed.folderId !== null) {
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

  // Prisma update : on n'envoie que les champs explicitement fournis.
  const data: Record<string, unknown> = {};
  if (parsed.title !== undefined) data.title = parsed.title;
  if (parsed.kind !== undefined) data.kind = parsed.kind;
  if (parsed.content !== undefined) data.content = parsed.content;
  if (parsed.summary !== undefined) data.summary = parsed.summary;
  if (parsed.sourceUrl !== undefined) data.sourceUrl = parsed.sourceUrl;
  if (parsed.fileId !== undefined) data.fileId = parsed.fileId;
  if (parsed.tags !== undefined) data.tags = parsed.tags;
  if (parsed.enabled !== undefined) data.enabled = parsed.enabled;
  if (parsed.domain !== undefined) data.domain = parsed.domain;
  if (parsed.folderId !== undefined) data.folderId = parsed.folderId;

  const updated = await prisma.knowledgeSource.update({
    where: { id },
    data,
  });

  // Re-indexation RAG si le contenu sémantiquement chunké a changé.
  // `title` est préfixé au content lors du chunking → si le titre change,
  // le 1er chunk change aussi → reindex. `summary` est aussi préfixé.
  // Pas de re-index si seulement `enabled`/`tags`/`sourceUrl` changent
  // (sémantique du chunk identique).
  const contentChanged =
    parsed.content !== undefined ||
    parsed.title !== undefined ||
    parsed.summary !== undefined;
  if (contentChanged) {
    runIndexInBackground(updated.id);
  }

  return NextResponse.json({
    id: updated.id,
    title: updated.title,
    enabled: updated.enabled,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  try {
    await prisma.knowledgeSource.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Source introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
