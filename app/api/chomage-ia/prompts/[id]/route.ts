/**
 * GET    /api/chomage-ia/prompts/[id] → détail complet d'un prompt généré
 * DELETE /api/chomage-ia/prompts/[id] → suppression de l'historique
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  const prompt = await prisma.generatedPrompt.findUnique({ where: { id } });
  if (!prompt) {
    return NextResponse.json({ error: "Prompt introuvable" }, { status: 404 });
  }
  const cited =
    prompt.citedSourceIds.length > 0
      ? await prisma.knowledgeSource.findMany({
          where: { id: { in: prompt.citedSourceIds } },
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
    id: prompt.id,
    title: prompt.title,
    brief: prompt.brief,
    output: prompt.output,
    domain: prompt.domain,
    citedSources: cited,
    createdAt: prompt.createdAt.toISOString(),
  });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const { id } = await params;
  try {
    await prisma.generatedPrompt.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Prompt introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
