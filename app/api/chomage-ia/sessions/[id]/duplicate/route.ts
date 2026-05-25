/**
 * POST /api/chomage-ia/sessions/[id]/duplicate
 *
 * Duplique une ChatSession (copie le title préfixé "Copie de · …" et tous
 * les messages dans l'ordre chronologique). Conserve folderId mais réinitialise
 * pinned=false et archived=false. Renvoie l'id de la nouvelle session pour
 * que le front puisse y naviguer.
 *
 * Use cases : fork une conv pour expérimenter sans toucher l'originale,
 * partir d'un brief existant comme base, etc.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const TITLE_PREFIX = "Copie de · ";
const TITLE_MAX = 200;

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:sessions:duplicate:${ip}`, {
    windowMs: 60_000,
    max: 10,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  const { id } = await params;
  const source = await prisma.chatSession.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!source) {
    return NextResponse.json({ error: "Session introuvable" }, { status: 404 });
  }

  // Préfixe court — on tronque si nécessaire pour rester sous 200 chars.
  const newTitle =
    (TITLE_PREFIX + source.title).slice(0, TITLE_MAX) ||
    "Nouvelle conversation";

  const created = await prisma.chatSession.create({
    data: {
      title: newTitle,
      domain: source.domain,
      folderId: source.folderId, // hérite du dossier
      pinned: false, // reset pinned (sinon spam le top du rail)
      archived: false, // reset archived
      createdById: auth.user.id,
      messages: {
        create: source.messages.map((m) => ({
          role: m.role,
          content: m.content,
          citedSourceIds: m.citedSourceIds,
          model: m.model,
          tokensIn: m.tokensIn,
          tokensOut: m.tokensOut,
        })),
      },
    },
    select: {
      id: true,
      title: true,
      domain: true,
      pinned: true,
      archived: true,
      folderId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json({
    id: created.id,
    title: created.title,
    domain: created.domain,
    pinned: created.pinned,
    archived: created.archived,
    folderId: created.folderId,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
    messageCount: created._count.messages,
  });
}
