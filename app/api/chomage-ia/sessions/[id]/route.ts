/**
 * GET    /api/chomage-ia/sessions/[id] → détail d'une session avec tous ses messages
 * PATCH  /api/chomage-ia/sessions/[id] → update partiel (title / pinned / archived / folderId / preferredModel)
 * DELETE /api/chomage-ia/sessions/[id] → suppression cascade (messages détruits aussi)
 *
 * Migration 17 : le PATCH accepte désormais aussi `pinned`, `archived`,
 * `folderId` en plus du `title` historique. Tous les champs sont optionnels —
 * on ne touche que ceux passés explicitement (semantique merge).
 *
 * Migration 18 : ajout `preferredModel` (null = défaut serveur Sonnet, sinon
 * une valeur de `CLAUDE_MODELS` — Sonnet 4.5 ou Haiku 4.5, pas Opus pour l'instant).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { CLAUDE_MODELS } from "@/lib/chomage-ia/models";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Modèles autorisés via PATCH (on exclut Opus volontairement pour l'instant). */
const ALLOWED_MODELS = [CLAUDE_MODELS.sonnet, CLAUDE_MODELS.haiku] as const;

const PatchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
    // null = retirer du dossier ; string = id du dossier cible.
    folderId: z.string().min(1).max(50).nullable().optional(),
    // null = reset au défaut serveur (Sonnet). String = un modèle de ALLOWED_MODELS.
    preferredModel: z
      .union([z.enum(ALLOWED_MODELS), z.null()])
      .optional(),
    /**
     * Migration 21 — scope multi-folder pour le retrieval RAG. Tableau d'IDs
     * de KnowledgeFolder. Tableau vide = toute la KB. Max 20 dossiers cumulés.
     */
    scopeFolderIds: z
      .array(z.string().min(1).max(50))
      .max(20)
      .optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.pinned !== undefined ||
      v.archived !== undefined ||
      v.folderId !== undefined ||
      v.preferredModel !== undefined ||
      v.scopeFolderIds !== undefined,
    { message: "Aucun champ à mettre à jour" }
  );

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const session = await prisma.chatSession.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  // Récupère les sources citées globalement dans la session pour affichage panneau.
  const allCitedIds = new Set<string>();
  for (const m of session.messages) {
    for (const id of m.citedSourceIds) allCitedIds.add(id);
  }
  const citedSources =
    allCitedIds.size > 0
      ? await prisma.knowledgeSource.findMany({
          where: { id: { in: [...allCitedIds] } },
          select: {
            id: true,
            title: true,
            kind: true,
            sourceUrl: true,
            summary: true,
          },
        })
      : [];

  return NextResponse.json({
    id: session.id,
    title: session.title,
    domain: session.domain,
    pinned: session.pinned,
    archived: session.archived,
    folderId: session.folderId,
    preferredModel: session.preferredModel,
    scopeFolderIds: session.scopeFolderIds,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      citedSourceIds: m.citedSourceIds,
      model: m.model,
      tokensIn: m.tokensIn,
      tokensOut: m.tokensOut,
      createdAt: m.createdAt.toISOString(),
    })),
    citedSources,
  });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  let parsed;
  try {
    parsed = PatchSchema.parse(body);
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

  // Validation : si folderId !== null, vérifier l'existence pour éviter le crash FK.
  if (
    parsed.folderId !== undefined &&
    parsed.folderId !== null
  ) {
    const folder = await prisma.chatFolder.findUnique({
      where: { id: parsed.folderId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json(
        { error: "Dossier introuvable" },
        { status: 400 }
      );
    }
  }

  // Migration 21 — validation scopeFolderIds : chaque ID doit pointer sur un
  // KnowledgeFolder existant. On accepte un tableau vide (= toute la KB).
  if (parsed.scopeFolderIds !== undefined && parsed.scopeFolderIds.length > 0) {
    const found = await prisma.knowledgeFolder.findMany({
      where: { id: { in: parsed.scopeFolderIds } },
      select: { id: true },
    });
    if (found.length !== parsed.scopeFolderIds.length) {
      return NextResponse.json(
        { error: "Au moins un dossier de scope est introuvable" },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await prisma.chatSession.update({
      where: { id },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.pinned !== undefined ? { pinned: parsed.pinned } : {}),
        ...(parsed.archived !== undefined ? { archived: parsed.archived } : {}),
        ...(parsed.folderId !== undefined ? { folderId: parsed.folderId } : {}),
        ...(parsed.preferredModel !== undefined
          ? { preferredModel: parsed.preferredModel }
          : {}),
        ...(parsed.scopeFolderIds !== undefined
          ? { scopeFolderIds: parsed.scopeFolderIds }
          : {}),
      },
    });
    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      pinned: updated.pinned,
      archived: updated.archived,
      folderId: updated.folderId,
      preferredModel: updated.preferredModel,
      scopeFolderIds: updated.scopeFolderIds,
    });
  } catch {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  try {
    await prisma.chatSession.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
