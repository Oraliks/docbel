/**
 * GET    /api/chomage-ia/sessions/[id] → détail d'une session avec tous ses messages
 * PATCH  /api/chomage-ia/sessions/[id] → update partiel (title / pinned / archived / folderId)
 * DELETE /api/chomage-ia/sessions/[id] → suppression cascade (messages détruits aussi)
 *
 * Migration 17 : le PATCH accepte désormais aussi `pinned`, `archived`,
 * `folderId` en plus du `title` historique. Tous les champs sont optionnels —
 * on ne touche que ceux passés explicitement (semantique merge).
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const PatchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    pinned: z.boolean().optional(),
    archived: z.boolean().optional(),
    // null = retirer du dossier ; string = id du dossier cible.
    folderId: z.string().min(1).max(50).nullable().optional(),
  })
  .refine(
    (v) =>
      v.title !== undefined ||
      v.pinned !== undefined ||
      v.archived !== undefined ||
      v.folderId !== undefined,
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

  try {
    const updated = await prisma.chatSession.update({
      where: { id },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.pinned !== undefined ? { pinned: parsed.pinned } : {}),
        ...(parsed.archived !== undefined ? { archived: parsed.archived } : {}),
        ...(parsed.folderId !== undefined ? { folderId: parsed.folderId } : {}),
      },
    });
    return NextResponse.json({
      id: updated.id,
      title: updated.title,
      pinned: updated.pinned,
      archived: updated.archived,
      folderId: updated.folderId,
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
