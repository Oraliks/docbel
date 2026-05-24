/**
 * GET /api/chomage-ia/sessions?domain=chomage
 *
 * Liste des sessions de chat pour le domaine donné, triées par updatedAt desc.
 * Renvoie aussi un compteur de messages par session pour l'affichage sidebar.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { DEFAULT_DOMAIN } from "@/lib/chomage-ia/types";

export async function GET(req: NextRequest) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const url = new URL(req.url);
  const domain = url.searchParams.get("domain") ?? DEFAULT_DOMAIN;

  const sessions = await prisma.chatSession.findMany({
    where: { domain },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      domain: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    items: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      domain: s.domain,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
      messageCount: s._count.messages,
    })),
  });
}
