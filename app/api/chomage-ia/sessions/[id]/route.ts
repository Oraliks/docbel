/**
 * GET    /api/chomage-ia/sessions/[id] → détail d'une session avec tous ses messages
 * PATCH  /api/chomage-ia/sessions/[id] → rename d'une session (title)
 * DELETE /api/chomage-ia/sessions/[id] → suppression cascade (messages détruits aussi)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const RenameSchema = z.object({
  title: z.string().min(1).max(200),
});

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
    parsed = RenameSchema.parse(body);
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
  try {
    const updated = await prisma.chatSession.update({
      where: { id },
      data: { title: parsed.title },
    });
    return NextResponse.json({ id: updated.id, title: updated.title });
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
