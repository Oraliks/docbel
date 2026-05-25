/**
 * DELETE /api/chomage-ia/messages/[id]
 *
 * Supprime un ChatMessage individuel. L'accès est restreint aux admins
 * (le module IA chômage est admin-only pour l'instant, donc pas de check
 * de propriété de session — toutes les sessions sont visibles par l'admin).
 *
 * Touche aussi `updatedAt` sur la session parente pour que le rail garde
 * un ordre cohérent (le message supprimé peut être ancien, mais l'action
 * récente le remonte logiquement dans la timeline).
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminAuth } from "@/lib/auth-check";
import { checkRateLimit, getClientIp } from "@/lib/documents/rate-limit";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const auth = await requireAdminAuth();
  if (!auth.isAuthorized) return auth.error;

  const ip = getClientIp(req);
  const rl = checkRateLimit(`chomage-ia:messages:delete:${ip}`, {
    windowMs: 60_000,
    max: 60,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes — réessayez dans une minute" },
      { status: 429 }
    );
  }

  const { id } = await params;

  // Vérifie l'existence du message + récupère sa sessionId pour le touch.
  const message = await prisma.chatMessage.findUnique({
    where: { id },
    select: { id: true, sessionId: true },
  });
  if (!message) {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
  }

  await prisma.chatMessage.delete({ where: { id } });

  // Touch la session pour refléter l'action récente dans l'ordre du rail.
  await prisma.chatSession
    .update({
      where: { id: message.sessionId },
      data: { updatedAt: new Date() },
    })
    .catch(() => {
      // Session déjà supprimée (cascade) — pas grave, on ignore.
    });

  return NextResponse.json({ ok: true });
}
